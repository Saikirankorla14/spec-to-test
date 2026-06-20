import StatusBadge from "./StatusBadge.jsx";

export default function TestResultsList({ tests = [] }) {
  if (!tests.length) {
    return (
      <div style={{ color: "var(--text-tertiary)", fontFamily: "var(--font-mono)", fontSize: 13, padding: "16px 0" }}>
        No test results yet.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {tests.map((t, i) => (
        <div
          key={`${t.name}-${i}`}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: "10px 12px",
            background: "var(--bg-inset)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-sm)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <code style={{ fontSize: 13, color: "var(--text-primary)" }}>{t.name}</code>
            <StatusBadge status={t.outcome === "passed" ? "pass" : "fail"}>
              {t.outcome}
            </StatusBadge>
          </div>
          {t.message && (
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11.5,
                color: "var(--status-fail)",
                whiteSpace: "pre-wrap",
                lineHeight: 1.5,
                opacity: 0.9,
              }}
            >
              {t.message}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
