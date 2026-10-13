import { useEffect, useMemo, useRef, useState } from "react";
import { pathOf } from "../lib/workspace";

export default function CommandPalette({ ws, commands, onOpenFile, onClose }) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const listRef = useRef(null);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const files = Object.values(ws.items)
      .filter((i) => i.type === "file")
      .map((i) => ({ label: pathOf(ws.items, i.id), hint: "Open drawing", run: () => onOpenFile(i.id), ico: "✏️" }));
    const cmds = commands.map((c) => ({ ...c, ico: "⚡" }));
    const all = [...cmds, ...files];
    return needle ? all.filter((r) => r.label.toLowerCase().includes(needle)) : all;
  }, [q, ws.items, commands, onOpenFile]);

  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    listRef.current?.children[sel]?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  const run = (r) => { onClose(); r?.run(); };

  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          autoFocus
          placeholder="Type a command or search drawings…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, results.length - 1)); }
            if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
            if (e.key === "Enter") run(results[sel]);
            if (e.key === "Escape") onClose();
          }}
        />
        <ul ref={listRef}>
          {results.map((r, i) => (
            <li key={r.label + i} className={i === sel ? "sel" : ""} onMouseEnter={() => setSel(i)} onClick={() => run(r)}>
              <span>{r.ico} {r.label}</span>
              <span className="muted small">{r.hint}</span>
            </li>
          ))}
          {!results.length && <li className="muted">Nothing found</li>}
        </ul>
      </div>
    </div>
  );
}
