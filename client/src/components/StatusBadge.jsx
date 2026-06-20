export default function StatusBadge({ status, children }) {
  const map = {
    pass: { bg: "var(--status-pass-bg)", color: "var(--status-pass)", dot: "var(--status-pass)" },
    fail: { bg: "var(--status-fail-bg)", color: "var(--status-fail)", dot: "var(--status-fail)" },
    gap: { bg: "var(--status-gap-bg)", color: "var(--status-gap)", dot: "var(--status-gap)" },
    neutral: { bg: "var(--bg-inset)", color: "var(--text-secondary)", dot: "var(--text-tertiary)" },
  };
  const c = map[status] || map.neutral;

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 999,
        background: c.bg,
        color: c.color,
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.2,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.dot, flexShrink: 0 }} />
      {children}
    </span>
  );
}
