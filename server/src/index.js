import "dotenv/config";
import express from "express";
import cors from "cors";
import { generateEdgeCaseTests, explainGap } from "./groqClient.js";
import { runTestsWithCoverage } from "./testRunner.js";
import { computeGapAnalysis, groupConsecutiveLines } from "./gapAnalysis.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 3001;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== "your_groq_api_key_here") });
});

/**
 * POST /api/generate
 * body: { code: string, specType: "python" | "openapi", existingTests?: string }
 * Generates a pytest edge-case suite via Groq. Does NOT execute it.
 */
app.post("/api/generate", async (req, res) => {
  const { code, specType = "python", existingTests = "" } = req.body || {};

  if (!code || typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "Field 'code' is required and must be a non-empty string." });
  }

  try {
    const testCode = await generateEdgeCaseTests({ code, specType, existingTests });
    res.json({ testCode });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * POST /api/run
 * body: { solutionCode: string, testCode: string }
 * Actually executes the test code against the solution in a sandboxed temp dir
 * via pytest + coverage.py. Returns real pass/fail and coverage data.
 */
app.post("/api/run", async (req, res) => {
  const { solutionCode, testCode } = req.body || {};

  if (!solutionCode || !testCode) {
    return res.status(400).json({ error: "Both 'solutionCode' and 'testCode' are required." });
  }

  try {
    const result = await runTestsWithCoverage({ solutionCode, testCode });
    res.json(result);
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * POST /api/full-pipeline
 * body: { code, existingTests?, specType? }
 * Orchestrates the full flow:
 *   1. (optional) run existing tests alone -> baseline coverage
 *   2. generate new edge-case tests via Groq
 *   3. run existing + generated tests together -> combined coverage
 *   4. compute gap analysis (what got newly covered, what's still missing)
 *   5. ask Groq to explain the remaining gaps in plain English
 */
app.post("/api/full-pipeline", async (req, res) => {
  const { code, existingTests = "", specType = "python" } = req.body || {};

  if (!code || !code.trim()) {
    return res.status(400).json({ error: "Field 'code' is required." });
  }

  try {
    // Step 1: baseline coverage from existing tests, if provided
    let baselineRun = null;
    if (existingTests && existingTests.trim()) {
      baselineRun = await runTestsWithCoverage({ solutionCode: code, testCode: existingTests });
    }

    // Step 2: generate new edge-case tests
    const generatedTestCode = await generateEdgeCaseTests({ code, specType, existingTests });

    // Step 3: run existing + generated together
    const combinedTestCode = existingTests && existingTests.trim()
      ? mergeTestFiles(existingTests, generatedTestCode)
      : generatedTestCode;

    const combinedRun = await runTestsWithCoverage({ solutionCode: code, testCode: combinedTestCode });

    // Step 4: gap analysis
    const generatedOnlyNames = combinedRun.tests
      ?.map((t) => t.name)
      .filter((name) => !baselineRun?.tests?.some((bt) => bt.name === name)) || [];

    const gaps = computeGapAnalysis({
      baselineCoverage: baselineRun?.coverage || null,
      combinedCoverage: combinedRun.coverage,
      generatedTestNames: generatedOnlyNames,
    });

    // Step 5: plain-English explanation of what's still uncovered (best-effort, non-blocking)
    let gapExplanation = null;
    if (gaps.stillUncoveredLines?.length > 0) {
      try {
        gapExplanation = await explainGap({ uncoveredLines: gaps.stillUncoveredLines, code });
      } catch {
        gapExplanation = null;
      }
    }

    res.json({
      generatedTestCode,
      combinedTestCode,
      baselineRun: baselineRun
        ? { summary: baselineRun.summary, coverage: baselineRun.coverage }
        : null,
      combinedRun: {
        summary: combinedRun.summary,
        tests: combinedRun.tests,
        coverage: combinedRun.coverage,
        rawStdout: combinedRun.rawStdout,
        exitCode: combinedRun.exitCode,
        stage: combinedRun.stage,
        error: combinedRun.error || null,
      },
      gaps: {
        ...gaps,
        newlyCoveredRanges: groupConsecutiveLines(gaps.newlyCoveredLines),
        stillUncoveredRanges: groupConsecutiveLines(gaps.stillUncoveredLines),
      },
      gapExplanation,
    });
  } catch (err) {
    handleError(res, err);
  }
});

function mergeTestFiles(existing, generated) {
  // Keep them as two clearly delimited sections in one file so pytest sees both.
  // We strip a duplicate "from solution import *" from the generated half if present.
  const cleanedGenerated = generated.replace(/^from solution import \*\s*$/m, "").trim();
  return `${existing.trim()}\n\n# ============================================================\n# AUTO-GENERATED EDGE CASE TESTS (below)\n# ============================================================\n\n${cleanedGenerated}\n`;
}

function handleError(res, err) {
  console.error(err);
  if (err.code === "MISSING_API_KEY") {
    return res.status(401).json({ error: err.message });
  }
  res.status(500).json({ error: err.message || "Internal server error." });
}

app.listen(PORT, () => {
  console.log(`spec-to-test server listening on http://localhost:${PORT}`);
});
