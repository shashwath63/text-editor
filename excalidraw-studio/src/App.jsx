import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWorkspace } from "./lib/workspace";
import { exportBackup, restoreBackup } from "./lib/storage";
import { download, exportExcalidraw, exportPng, exportSvg, readSceneFile } from "./lib/exporters";
import Sidebar from "./components/Sidebar";
import Tabs from "./components/Tabs";
import Editor from "./components/Editor";
import Overview from "./components/Overview";
import CommandPalette from "./components/CommandPalette";

export default function App() {
  const { ws, actions } = useWorkspace();
  const apiRef = useRef(null);
  const importRef = useRef(null);
  const restoreRef = useRef(null);
  const [status, setStatus] = useState("saved");
  const [palette, setPalette] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const theme = ws?.theme ?? "light";
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const active = ws?.activeId ? ws.items[ws.activeId] : null;
  useEffect(() => {
    document.title = active ? `${active.name} · Excalidraw Studio` : "Excalidraw Studio";
  }, [active]);

  const withApi = (fn) => () => {
    if (!apiRef.current || !active) return notify("Open a drawing first.");
    return Promise.resolve(fn(apiRef.current, active.name)).catch((e) => notify(`Export failed: ${e.message}`));
  };

  const onImportFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    const ok = [];
    for (const f of files) {
      try {
        ok.push({ name: f.name.replace(/\.(excalidraw|json|png|svg)$/i, ""), scene: await readSceneFile(f) });
      } catch {
        notify(`Could not import "${f.name}".`);
      }
    }
    if (ok.length) {
      await actions.importScenes(ok, active?.parentId ?? null);
      notify(`Imported ${ok.length} drawing${ok.length > 1 ? "s" : ""}.`);
    }
  };

  const onBackup = async () => {
    const backup = await exportBackup(ws);
    download(new Blob([JSON.stringify(backup)], { type: "application/json" }), `excalidraw-studio-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const onRestoreFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    if (!window.confirm("Restoring replaces ALL current drawings with the backup. Continue?")) return;
    try {
      const next = await restoreBackup(JSON.parse(await f.text()));
      actions.replaceAll(next);
      notify("Workspace restored.");
    } catch (err) {
      notify(err.message);
    }
  };

  const commands = useMemo(
    () => [
      { label: "New drawing", hint: "Alt+N", run: () => actions.createFile(null) },
      { label: "New folder", hint: "", run: () => actions.createFolder(null) },
      { label: "Toggle dark mode", hint: "", run: () => actions.setTheme(theme === "dark" ? "light" : "dark") },
      { label: "Toggle sidebar", hint: "Ctrl+B", run: actions.toggleSidebar },
      { label: "Show all drawings overview", hint: "", run: () => actions.setView("overview") },
      { label: "Close current tab", hint: "Alt+W", run: () => ws?.activeId && actions.closeTab(ws.activeId) },
      { label: "Export current as .excalidraw", hint: "", run: withApi(exportExcalidraw) },
      { label: "Export current as PNG", hint: "", run: withApi(exportPng) },
      { label: "Export current as SVG", hint: "", run: withApi(exportSvg) },
      { label: "Import files…", hint: "", run: () => importRef.current?.click() },
      { label: "Backup workspace", hint: "", run: onBackup },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, ws?.activeId, ws?.items, active],
  );

  // Keyboard shortcuts (browsers reserve Ctrl+N/W/T, so file ops use Alt).
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((p) => !p); }
      else if (mod && e.key.toLowerCase() === "b") { e.preventDefault(); actions.toggleSidebar(); }
      else if (e.altKey && e.code === "KeyN") { e.preventDefault(); actions.createFile(null); }
      else if (e.altKey && e.code === "KeyW") { e.preventDefault(); ws?.activeId && actions.closeTab(ws.activeId); }
      else if (e.altKey && (e.code === "ArrowRight" || e.code === "ArrowLeft") && ws?.tabs.length > 1) {
        e.preventDefault();
        const i = ws.tabs.indexOf(ws.activeId);
        const n = (i + (e.code === "ArrowRight" ? 1 : -1) + ws.tabs.length) % ws.tabs.length;
        actions.setActive(ws.tabs[n]);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onSaved = useCallback((id, elementCount) => actions.touch(id, { elementCount }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const onApi = useCallback((api) => { apiRef.current = api; }, []);

  if (!ws) return <div className="center-note full">Loading workspace…</div>;

  const showEditor = ws.view === "editor" && active && active.type === "file";

  return (
    <div className="app">
      <header className="topbar">
        <button className="icon-btn" onClick={actions.toggleSidebar} title="Toggle sidebar (Ctrl+B)">☰</button>
        <strong className="brand">Excalidraw Studio</strong>
        <div className="spacer" />
        <button className="btn" onClick={() => setPalette(true)} title="Ctrl+K">⌘ Command palette</button>
        <button className={`btn ${ws.view === "overview" ? "primary" : ""}`} onClick={() => actions.setView(ws.view === "overview" ? "editor" : "overview")}>▦ Overview</button>
        <button className="btn" onClick={withApi(exportExcalidraw)} disabled={!showEditor}>⬇ .excalidraw</button>
        <button className="btn" onClick={withApi(exportPng)} disabled={!showEditor}>PNG</button>
        <button className="btn" onClick={withApi(exportSvg)} disabled={!showEditor}>SVG</button>
        <button className="icon-btn" onClick={() => actions.setTheme(theme === "dark" ? "light" : "dark")} title="Toggle theme">
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </header>

      <div className="body">
        {ws.sidebarOpen && (
          <Sidebar
            ws={ws}
            actions={actions}
            onImport={() => importRef.current?.click()}
            onBackup={onBackup}
            onRestore={() => restoreRef.current?.click()}
          />
        )}
        <main className="main">
          <Tabs ws={ws} actions={actions} />
          <div className="canvas">
            {ws.view === "overview" ? (
              <Overview ws={ws} actions={actions} />
            ) : showEditor ? (
              <Editor key={active.id} file={active} theme={theme} onApi={onApi} onSaved={onSaved} onStatus={setStatus} />
            ) : (
              <div className="center-note">
                <p>No drawing open.</p>
                <button className="btn primary" onClick={() => actions.createFile(null)}>＋ New drawing</button>
              </div>
            )}
          </div>
          <footer className="statusbar">
            <span>{active ? `${active.name} · ${active.elementCount ?? 0} elements` : "—"}</span>
            <span className={`status ${status}`}>
              {status === "saving" ? "● Saving…" : status === "error" ? "⚠ Save failed" : "✓ Saved locally"}
            </span>
          </footer>
        </main>
      </div>

      <input ref={importRef} type="file" multiple accept=".excalidraw,.json,.png,.svg" hidden onChange={onImportFiles} />
      <input ref={restoreRef} type="file" accept=".json" hidden onChange={onRestoreFile} />
      {palette && (
        <CommandPalette ws={ws} commands={commands} onOpenFile={actions.openFile} onClose={() => setPalette(false)} />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
