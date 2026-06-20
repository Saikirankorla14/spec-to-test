/**
 * Renders source lines as a segmented vertical strip: each line gets a
 * thin colored tick — teal if covered, amber if not, hairline if non-executable.
 * This is the app's signature visual: a literal "diagnostic readout" of the
 * code under test, like an oscilloscope trace of what your tests actually touch.
 */
export default function CoverageBar({ sourceCode, coveredLines = [], missingLines = [] }) {
  if (!sourceCode) return null;
  const lines = sourceCode.split("\n");
  const covered = new Set(coveredLines);
  const missing = new Set(missingLines);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        padding: "8px 0",
      }}
      aria-hidden="true"
    >
      {lines.map((_, idx) => {
        const lineNo = idx + 1;
        let color = "var(--border-hairline)";
        let width = "40%";
        if (covered.has(lineNo)) {
          color = "var(--accent-teal)";
          width = "100%";
        } else if (missing.has(lineNo)) {
          color = "var(--status-gap)";
          width = "100%";
        }
        return (
          <div
            key={idx}
            style={{
              height: 3,
              width,
              background: color,
              borderRadius: 2,
              transition: "background 0.2s ease",
            }}
          />
        );
      })}
    </div>
  );
}
