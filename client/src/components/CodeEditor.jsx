import CodeMirror from "@uiw/react-codemirror";
import { python } from "@codemirror/lang-python";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { EditorView } from "@codemirror/view";

const customTheme = EditorView.theme({
  "&": {
    backgroundColor: "var(--bg-inset) !important",
    fontSize: "13px",
    height: "100%",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-inset) !important",
    border: "none !important",
    color: "var(--text-tertiary) !important",
  },
  ".cm-content": {
    fontFamily: "var(--font-mono) !important",
    caretColor: "var(--accent-teal)",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(94, 234, 212, 0.04) !important",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(94, 234, 212, 0.06) !important",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent-teal) !important",
  },
  ".cm-scroller": {
    fontFamily: "var(--font-mono) !important",
  },
});

export default function CodeEditor({ value, onChange, readOnly = false, placeholder = "", minHeight = "260px" }) {
  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[python()]}
      theme={vscodeDark}
      editable={!readOnly}
      readOnly={readOnly}
      placeholder={placeholder}
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
      }}
      style={{
        height: "100%",
        minHeight,
        borderRadius: "var(--radius-md)",
        overflow: "hidden",
        border: "1px solid var(--border-hairline)",
      }}
    />
  );
}
