import { useState, useCallback } from "react";
import CodeEditor from "./components/CodeEditor.jsx";
import StatusBadge from "./components/StatusBadge.jsx";
import CoverageBar from "./components/CoverageBar.jsx";
import TestResultsList from "./components/TestResultsList.jsx";
import GapReport from "./components/GapReport.jsx";
import { runFullPipeline } from "./api.js";
import { SAMPLES } from "./samples.js";

const STAGES = {
  IDLE: "idle",
  RUNNING: "running",
  DONE: "done",
  ERROR: "error",
};

export default function App() {
  const [code, setCode] = useState(SAMPLES.password_validator.code);
  const [existingTests, setExistingTests] = useState(SAMPLES.password_validator.existingTests);
  const [stage, setStage] = useState(STAGES.IDLE);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("tests"); // tests | coverage | report

  const loadSample = useCallback((key) => {
    const sample = SAMPLES[key];
    setCode(sample.code);
    setExistingTests(sample.existingTests);
    setResult(null);
    setStage(STAGES.IDLE);
    setError(null);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!code.trim()) {
      setError("Paste in some Python code first — that's what gets tested.");
      setStage(STAGES.ERROR);
      return;
    }
    setStage(STAGES.RUNNING);
    setError(null);
    setResult(null);
    try {
      const data = await runFullPipeline({ code, existingTests, specType: "python" });
      setResult(data);
      setStage(STAGES.DONE);
      setActiveTab("tests");
    } catch (err) {
      setError(err.message);
      setStage(STAGES.ERROR);
    }
  }, [code, existingTests]);

  const isRunning = stage === STAGES.RUNNING;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />

      <main style={{ flex: 1, maxWidth: 1400, margin: "0 auto", width: "100%", padding: "28px 32px 80px" }}>
        <IntroBlock />

        <SampleBar onLoad={loadSample} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginTop: 20 }}>
          <Panel
            title="solution.py"
            subtitle="the code under test"
          >
            <CodeEditor value={code} onChange={setCode} minHeight="320px" placeholder="def your_function(...):\n    ..." />
          </Panel>

          <Panel
            title="existing tests"
            subtitle="optional — paste your current pytest suite to see what it's missing"
          >
            <CodeEditor
              value={existingTests}
              onChange={setExistingTests}
              minHeight="320px"
              placeholder="from solution import *\n\ndef test_something():\n    ..."
            />
          </Panel>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
          <button
            onClick={handleGenerate}
            disabled={isRunning}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "13px 26px",
              background: isRunning ? "var(--bg-panel-raised)" : "var(--accent-teal)",
              color: isRunning ? "var(--text-secondary)" : "#06231e",
              border: "none",
              borderRadius: "var(--radius-md)",
              fontSize: 14.5,
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              cursor: isRunning ? "default" : "pointer",
              transition: "transform 0.1s ease, box-shadow 0.2s ease",
              boxShadow: isRunning ? "none" : "0 0 0 1px var(--accent-teal-dim), 0 4px 20px -4px rgba(94,234,212,0.3)",
            }}
            onMouseDown={(e) => !isRunning && (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {isRunning ? (
              <>
                <Spinner /> generating &amp; executing…
              </>
            ) : (
              <>▸ generate &amp; run edge cases</>
            )}
          </button>

          {error && (
            <span style={{ color: "var(--status-fail)", fontSize: 13, fontFamily: "var(--font-mono)" }}>
              {error.includes("GROQ_API_KEY") ? (
                <>
                  no Groq API key configured — add one to{" "}
                  <code style={{ background: "var(--bg-inset)", padding: "1px 5px", borderRadius: 3 }}>
                    server/.env
                  </code>{" "}
                  (get a free key at{" "}
                  <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" style={{ color: "var(--accent-teal)" }}>
                    console.groq.com/keys
                  </a>
                  )
                </>
              ) : (
                error
              )}
            </span>
          )}

          <span style={{ color: "var(--text-tertiary)", fontSize: 12, marginLeft: "auto" }}>
            tests are generated by an LLM, then actually executed with pytest + coverage.py — not just claimed
          </span>
        </div>

        {stage === STAGES.DONE && result && (
          <ResultsSection result={result} activeTab={activeTab} setActiveTab={setActiveTab} code={code} />
        )}
      </main>

      <Footer />
    </div>
  );
}

function Header() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border-hairline)",
        padding: "18px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        background: "rgba(10,12,16,0.85)",
        backdropFilter: "blur(10px)",
        zIndex: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 7,
            background: "var(--accent-teal)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "var(--font-mono)",
            fontWeight: 800,
            color: "#06231e",
            fontSize: 14,
          }}
        >
          ▸_
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, fontSize: 15, letterSpacing: -0.2 }}>
          spec<span style={{ color: "var(--accent-teal)" }}>→</span>test
        </span>
      </div>
      <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
        pytest · coverage.py · groq
      </span>
    </header>
  );
}

function IntroBlock() {
  return (
    <div style={{ marginTop: 28, marginBottom: 4 }}>
      <h1
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: -0.6,
          margin: 0,
          lineHeight: 1.25,
        }}
      >
        Find the bugs your tests don't know to look for.
      </h1>
      <p style={{ color: "var(--text-secondary)", fontSize: 14.5, marginTop: 8, maxWidth: 640, lineHeight: 1.6 }}>
        Paste a Python function or class. An LLM drafts adversarial edge-case tests — boundaries, nulls, type
        confusion, off-by-ones. Then they're actually executed against your code with{" "}
        <code style={{ color: "var(--text-primary)" }}>pytest</code> and{" "}
        <code style={{ color: "var(--text-primary)" }}>coverage.py</code>, so the report reflects real pass/fail and
        real line coverage — not a model's guess.
      </p>
    </div>
  );
}

function SampleBar({ onLoad }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 16, alignItems: "center" }}>
      <span style={{ fontSize: 11.5, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
        load example:
      </span>
      {Object.entries(SAMPLES).map(([key, s]) => (
        <button
          key={key}
          onClick={() => onLoad(key)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            padding: "5px 11px",
            background: "var(--bg-panel)",
            border: "1px solid var(--border-hairline)",
            borderRadius: 6,
            color: "var(--text-secondary)",
            cursor: "pointer",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent-teal)")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border-hairline)")}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div
      style={{
        background: "var(--bg-panel)",
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: "var(--text-tertiary)", marginTop: 2 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 13,
        height: 13,
        border: "2px solid var(--border-glow)",
        borderTopColor: "var(--text-secondary)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

function ResultsSection({ result, activeTab, setActiveTab, code }) {
  const { combinedRun, gaps, gapExplanation, generatedTestCode, baselineRun } = result;
  const passed = combinedRun?.summary?.passed ?? 0;
  const failed = combinedRun?.summary?.failed ?? 0;

  if (combinedRun?.stage === "syntax_check") {
    return (
      <div
        style={{
          marginTop: 28,
          padding: 20,
          background: "var(--status-fail-bg)",
          border: "1px solid var(--status-fail)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div style={{ fontWeight: 700, color: "var(--status-fail)", marginBottom: 8 }}>
          Generated test file failed to parse
        </div>
        <pre
          style={{
            fontSize: 12,
            color: "var(--text-secondary)",
            whiteSpace: "pre-wrap",
            margin: 0,
            fontFamily: "var(--font-mono)",
          }}
        >
          {combinedRun.error}
        </pre>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <StatusBadge status={failed > 0 ? "fail" : "pass"}>
          {passed} passed{failed > 0 ? ` · ${failed} failed` : ""}
        </StatusBadge>
        {gaps?.combinedPercent != null && (
          <StatusBadge status="neutral">{gaps.combinedPercent}% line coverage</StatusBadge>
        )}
        <TabBar active={activeTab} setActive={setActiveTab} />
      </div>

      {activeTab === "tests" && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 20 }}>
          <Panel title="generated test file" subtitle="edge cases drafted by the model, then executed for real">
            <CodeEditor value={generatedTestCode || ""} readOnly minHeight="420px" />
          </Panel>
          <Panel title="execution results" subtitle="actual pytest output, parsed from JUnit XML">
            <div style={{ maxHeight: 420, overflowY: "auto" }}>
              <TestResultsList tests={combinedRun?.tests} />
            </div>
          </Panel>
        </div>
      )}

      {activeTab === "coverage" && (
        <Panel title="line coverage" subtitle="teal = exercised by a test · amber = never executed">
          <div style={{ display: "flex", gap: 18 }}>
            <div style={{ width: 90, flexShrink: 0 }}>
              <CoverageBar
                sourceCode={code}
                coveredLines={gaps?.newlyCoveredLines?.length || baselineRun ? combinedRun?.coverage?.coveredLines : combinedRun?.coverage?.coveredLines}
                missingLines={combinedRun?.coverage?.missingLines}
              />
            </div>
            <div style={{ flex: 1, fontFamily: "var(--font-mono)", fontSize: 12.5, color: "var(--text-secondary)" }}>
              <pre style={{ margin: 0, lineHeight: "19px" }}>
                {code.split("\n").map((line, idx) => {
                  const lineNo = idx + 1;
                  const covered = combinedRun?.coverage?.coveredLines?.includes(lineNo);
                  const missing = combinedRun?.coverage?.missingLines?.includes(lineNo);
                  return (
                    <div
                      key={idx}
                      style={{
                        color: missing ? "var(--status-gap)" : covered ? "var(--text-primary)" : "var(--text-tertiary)",
                        background: missing ? "var(--status-gap-bg)" : "transparent",
                      }}
                    >
                      {line || " "}
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        </Panel>
      )}

      {activeTab === "report" && (
        <GapReport gaps={gaps} gapExplanation={gapExplanation} baselineRun={baselineRun} />
      )}
    </div>
  );
}

function TabBar({ active, setActive }) {
  const tabs = [
    { key: "tests", label: "tests" },
    { key: "coverage", label: "coverage" },
    { key: "report", label: "gap report" },
  ];
  return (
    <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => setActive(t.key)}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12.5,
            padding: "7px 14px",
            background: active === t.key ? "var(--bg-panel-raised)" : "transparent",
            border: `1px solid ${active === t.key ? "var(--border-glow)" : "transparent"}`,
            borderRadius: 7,
            color: active === t.key ? "var(--accent-teal)" : "var(--text-tertiary)",
            cursor: "pointer",
            fontWeight: active === t.key ? 600 : 400,
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

function Footer() {
  return (
    <footer
      style={{
        borderTop: "1px solid var(--border-hairline)",
        padding: "18px 32px",
        textAlign: "center",
        fontSize: 11.5,
        color: "var(--text-tertiary)",
        fontFamily: "var(--font-mono)",
      }}
    >
      generated tests run in an isolated temp directory · 20s execution timeout · no network access from sandboxed code
    </footer>
  );
}
