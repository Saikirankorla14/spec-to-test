import { mkdtemp, writeFile, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawn, spawnSync } from "child_process";

const EXEC_TIMEOUT_MS = 20_000;

let cachedPythonCmd = null;

/**
 * Finds a working Python 3 executable across platforms. On most Linux/macOS
 * setups it's "python3"; on Windows (and some macOS installs) it's "python".
 * We probe both once and cache the result for the life of the process.
 */
function resolvePythonCommand() {
  if (cachedPythonCmd) return cachedPythonCmd;

  const candidates =
    process.platform === "win32"
      ? ["python", "py", "python3"]
      : ["python3", "python"];

  for (const candidate of candidates) {
    try {
      const result = spawnSync(candidate, ["--version"], { timeout: 5000 });
      // A real Python prints "Python 3.x.y" to stdout or stderr and exits 0.
      const out = `${result.stdout || ""}${result.stderr || ""}`;
      if (result.status === 0 && /Python 3\./.test(out)) {
        cachedPythonCmd = candidate;
        return cachedPythonCmd;
      }
    } catch {
      // try next candidate
    }
  }

  const err = new Error(
    "Could not find a working Python 3 installation (tried: " +
      candidates.join(", ") +
      "). Make sure Python 3 is installed and on your PATH, with 'pytest' and 'coverage' installed (pip install pytest coverage).",
  );
  err.code = "PYTHON_NOT_FOUND";
  throw err;
}

function runProcess(cmd, args, opts) {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { ...opts, timeout: EXEC_TIMEOUT_MS });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (exitCode) => resolve({ stdout, stderr, exitCode }));
    proc.on("error", (err) =>
      resolve({ stdout, stderr: String(err), exitCode: -1 }),
    );
  });
}

/**
 * Runs generated pytest tests against user code in an isolated temp directory,
 * collects coverage, and returns structured results. Never trusts the LLM's
 * claims about pass/fail — actually executes everything.
 */
export async function runTestsWithCoverage({ solutionCode, testCode }) {
  let pythonCmd;
  try {
    pythonCmd = resolvePythonCommand();
  } catch (err) {
    return {
      success: false,
      stage: "python_not_found",
      error: err.message,
      tests: [],
      coverage: null,
    };
  }

  const dir = await mkdtemp(join(tmpdir(), "spec2test-"));
  const solutionPath = join(dir, "solution.py");
  const testPath = join(dir, "test_solution.py");
  const coverageJsonPath = join(dir, "coverage.json");

  await writeFile(solutionPath, solutionCode, "utf-8");
  await writeFile(testPath, testCode, "utf-8");

  // 1. Syntax-check the generated test file before running anything.
  const syntaxCheck = await runProcess(
    pythonCmd,
    ["-m", "py_compile", testPath],
    { cwd: dir },
  );
  if (syntaxCheck.exitCode !== 0) {
    await cleanup(dir);
    return {
      success: false,
      stage: "syntax_check",
      error: syntaxCheck.stderr || "Generated test file has a syntax error.",
      tests: [],
      coverage: null,
    };
  }

  // 2. Run pytest under coverage, with JUnit XML report (built into pytest, no plugin needed).
  const reportPath = join(dir, "report.xml");
  const pytestArgs = [
    "-m",
    "coverage",
    "run",
    "--branch",
    "--source=solution",
    "-m",
    "pytest",
    testPath,
    "-v",
    "--tb=short",
    `--junit-xml=${reportPath}`,
  ];

  const runResult = await runProcess(pythonCmd, pytestArgs, { cwd: dir });

  // 3. Export coverage as JSON for structured parsing.
  const covExport = await runProcess(
    pythonCmd,
    ["-m", "coverage", "json", "-o", coverageJsonPath],
    { cwd: dir },
  );

  let coverageData = null;
  try {
    const raw = await readFile(coverageJsonPath, "utf-8");
    coverageData = JSON.parse(raw);
  } catch {
    coverageData = null;
  }

  const testResults = parsePytestLog(await safeRead(reportPath));
  const summary = summarizeFromStdout(runResult.stdout);

  await cleanup(dir);

  return {
    success: true,
    stage: "complete",
    rawStdout: runResult.stdout,
    rawStderr: runResult.stderr,
    exitCode: runResult.exitCode,
    tests: testResults.length ? testResults : summary.tests,
    summary: summary.counts,
    coverage: coverageData
      ? normalizeCoverage(coverageData, solutionCode)
      : null,
    coverageRaw: covExport.stderr || null,
  };
}

async function safeRead(path) {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

async function cleanup(dir) {
  try {
    await rm(dir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}

function parsePytestLog(xmlText) {
  if (!xmlText) return [];
  const tests = [];
  // Match each <testcase ...>...</testcase> or self-closing <testcase .../>
  // Use a non-greedy match anchored on the testcase tag boundaries to avoid
  // bleeding into the next testcase when the XML is all on one line.
  const caseRe =
    /<testcase\b((?:[^>"]|"[^"]*")*?)(\/>|>([\s\S]*?)<\/testcase>)/g;
  let match;
  while ((match = caseRe.exec(xmlText)) !== null) {
    const attrs = match[1];
    const inner = match[3] || "";
    const name = (attrs.match(/\bname="([^"]*)"/) || [])[1] || "unknown";
    const time = parseFloat((attrs.match(/\btime="([^"]*)"/) || [])[1] || "0");

    let outcome = "passed";
    let message = null;
    const failMatch = inner.match(/<failure\b[^>]*message="([^"]*)"/);
    const errMatch = inner.match(/<error\b[^>]*message="([^"]*)"/);
    const skipMatch = inner.match(/<skipped\b/);
    if (failMatch) {
      outcome = "failed";
      message = decodeXmlEntities(failMatch[1]);
    } else if (errMatch) {
      outcome = "error";
      message = decodeXmlEntities(errMatch[1]);
    } else if (skipMatch) {
      outcome = "skipped";
    }

    tests.push({ name, outcome, duration: time, message });
  }
  return tests;
}

function decodeXmlEntities(str) {
  return str
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#10;/g, "\n")
    .replace(/&#13;/g, "\r")
    .replace(/&amp;/g, "&");
}

function summarizeFromStdout(stdout) {
  // Fallback parser: pulls per-test PASS/FAIL from -v output and the summary line.
  const tests = [];
  const lineRe = /^(test_\S+)\s+(PASSED|FAILED|ERROR)/gm;
  let match;
  while ((match = lineRe.exec(stdout)) !== null) {
    tests.push({
      name: match[1],
      outcome: match[2].toLowerCase(),
      duration: null,
      message: null,
    });
  }

  const summaryMatch =
    stdout.match(/(\d+) passed(?:, (\d+) failed)?(?:, (\d+) error)?/) ||
    stdout.match(/(\d+) failed(?:, (\d+) passed)?/);

  const passed = (stdout.match(/(\d+) passed/) || [])[1];
  const failed = (stdout.match(/(\d+) failed/) || [])[1];
  const errors = (stdout.match(/(\d+) error/) || [])[1];

  return {
    tests,
    counts: {
      passed: parseInt(passed || "0", 10),
      failed: parseInt(failed || "0", 10),
      errors: parseInt(errors || "0", 10),
      total: tests.length,
    },
  };
}

function normalizeCoverage(coverageJson, solutionCode) {
  const fileData = coverageJson.files?.["solution.py"];
  if (!fileData) return null;

  const totalLines = solutionCode.split("\n");
  const executable = fileData.executed_lines
    .concat(fileData.missing_lines)
    .sort((a, b) => a - b);

  return {
    percentCovered: fileData.summary?.percent_covered ?? null,
    coveredLines: fileData.executed_lines || [],
    missingLines: fileData.missing_lines || [],
    excludedLines: fileData.excluded_lines || [],
    numStatements: fileData.summary?.num_statements ?? executable.length,
    missingBranches: fileData.summary?.missing_branches ?? null,
    totalLineCount: totalLines.length,
  };
}
