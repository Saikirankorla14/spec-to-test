import StatusBadge from "./StatusBadge.jsx";

export default function GapReport({ gaps, gapExplanation, baselineRun }) {
  if (!gaps) return null;

  const {
    hasBaseline,
    baselinePercent,
    combinedPercent,
    newlyCoveredRanges = [],
    stillUncoveredRanges = [],
    percentImprovement,
    generatedTestCount,
  } = gaps;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {hasBaseline && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto 1fr",
            alignItems: "center",
            gap: 16,
            padding: "18px 20px",
            background: "var(--bg-panel-raised)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <MetricBlock label="your tests alone" value={`${baselinePercent}%`} sub="line coverage" />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 20,
              color: percentImprovement > 0 ? "var(--accent-teal)" : "var(--text-tertiary)",
              fontWeight: 700,
            }}
          >
            {percentImprovement > 0 ? `+${percentImprovement}` : percentImprovement}
            <span style={{ fontSize: 12, marginLeft: 2 }}>pt</span>
            <div style={{ fontSize: 18, textAlign: "center" }}>→</div>
          </div>
          <MetricBlock
            label="with generated edge cases"
            value={`${combinedPercent}%`}
            sub={`${generatedTestCount} new tests`}
            highlight
          />
        </div>
      )}

      {!hasBaseline && (
        <div
          style={{
            padding: "14px 16px",
            background: "var(--bg-inset)",
            border: "1px dashed var(--border-glow)",
            borderRadius: "var(--radius-md)",
            fontSize: 13,
            color: "var(--text-secondary)",
          }}
        >
          No existing test suite was provided, so this shows coverage from the generated edge-case tests alone —{" "}
          <strong style={{ color: "var(--text-primary)" }}>{combinedPercent}%</strong> of executable lines.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <GapColumn
          title="newly covered"
          ranges={newlyCoveredRanges}
          status="pass"
          empty="No previously-uncovered lines were closed."
        />
        <GapColumn
          title="still uncovered"
          ranges={stillUncoveredRanges}
          status="gap"
          empty="Nothing left uncovered — full line coverage achieved."
        />
      </div>

      {gapExplanation && (
        <div
          style={{
            padding: "16px 18px",
            background: "var(--bg-inset)",
            border: "1px solid var(--border-hairline)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
              color: "var(--text-tertiary)",
              marginBottom: 10,
            }}
          >
            Why these gaps matter
          </div>
          <div
            style={{
              fontSize: 13.5,
              lineHeight: 1.7,
              color: "var(--text-secondary)",
              whiteSpace: "pre-wrap",
            }}
          >
            {gapExplanation}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBlock({ label, value, sub, highlight }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: 0.6 }}>
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 28,
          fontWeight: 700,
          color: highlight ? "var(--accent-teal)" : "var(--text-primary)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{sub}</div>
    </div>
  );
}

function GapColumn({ title, ranges, status, empty }) {
  return (
    <div
      style={{
        padding: "14px 16px",
        background: "var(--bg-panel-raised)",
        border: "1px solid var(--border-hairline)",
        borderRadius: "var(--radius-md)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontSize: 12.5, color: "var(--text-secondary)", fontWeight: 600 }}>{title}</span>
        <StatusBadge status={status}>{ranges.length}</StatusBadge>
      </div>
      {ranges.length === 0 ? (
        <div style={{ fontSize: 12.5, color: "var(--text-tertiary)", fontStyle: "italic" }}>{empty}</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ranges.map((r) => (
            <code
              key={r}
              style={{
                fontSize: 12,
                padding: "2px 7px",
                borderRadius: 4,
                background: "var(--bg-inset)",
                color: status === "pass" ? "var(--accent-teal)" : "var(--status-gap)",
                border: `1px solid ${status === "pass" ? "var(--accent-teal-dim)" : "var(--status-gap-bg)"}`,
              }}
            >
              L{r}
            </code>
          ))}
        </div>
      )}
    </div>
  );
}
