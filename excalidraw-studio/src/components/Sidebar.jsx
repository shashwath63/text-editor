import { useEffect, useMemo, useRef, useState } from "react";
import { childrenOf, pathOf } from "../lib/workspace";

function ContextMenu({ menu, onClose }) {
  useEffect(() => {
    const close = () => onClose();
    window.addEventListener("click", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", (e) => e.key === "Escape" && close());
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("blur", close);
    };
  }, [onClose]);
  if (!menu) return null;
  return (
    <ul className="ctx" style={{ left: menu.x, top: menu.y }} onClick={(e) => e.stopPropagation()}>
      {menu.entries.map((e, i) =>
        e === "-" ? (
          <li key={i} className="sep" />
        ) : (
          <li key={e.label} className={e.danger ? "danger" : ""} onClick={() => { onClose(); e.run(); }}>
            {e.label}
          </li>
        ),
      )}
    </ul>
  );
}

function Row({ item, depth, ctx }) {
  const { ws, actions, renamingId, setRenamingId, openMenu, dragId, setDragId, dropTarget, setDropTarget } = ctx;
  const isFolder = item.type === "folder";
  const open = ws.expanded[item.id];
  const active = ws.activeId === item.id && ws.view === "editor";
  const inputRef = useRef(null);

  useEffect(() => {
    if (renamingId === item.id) inputRef.current?.select();
  }, [renamingId, item.id]);

  const commit = (value) => {
    actions.rename(item.id, value);
    setRenamingId(null);
  };

  return (
    <>
      <div
        className={`row ${active ? "active" : ""} ${dropTarget === item.id ? "drop" : ""}`}
        style={{ paddingLeft: 8 + depth * 14 }}
        draggable={renamingId !== item.id}
        onDragStart={(e) => { e.dataTransfer.setData("text/plain", item.id); setDragId(item.id); }}
        onDragEnd={() => { setDragId(null); setDropTarget(null); }}
        onDragOver={(e) => {
          if (isFolder && dragId && dragId !== item.id) { e.preventDefault(); e.stopPropagation(); setDropTarget(item.id); }
        }}
        onDrop={(e) => {
          if (!isFolder || !dragId) return;
          e.preventDefault(); e.stopPropagation();
          actions.move(dragId, item.id);
          setDragId(null); setDropTarget(null);
        }}
        onClick={() => (isFolder ? actions.toggleFolder(item.id) : actions.openFile(item.id))}
        onDoubleClick={() => setRenamingId(item.id)}
        onContextMenu={(e) => { e.preventDefault(); openMenu(e, item); }}
      >
        <span className="chev">{isFolder ? (open ? "▾" : "▸") : ""}</span>
        <span className="ico">{isFolder ? (open ? "📂" : "📁") : "✏️"}</span>
        {renamingId === item.id ? (
          <input
            ref={inputRef}
            className="rename"
            autoFocus
            defaultValue={item.name}
            onClick={(e) => e.stopPropagation()}
            onBlur={(e) => commit(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit(e.target.value);
              if (e.key === "Escape") setRenamingId(null);
            }}
          />
        ) : (
          <span className="name" title={item.name}>{item.name}</span>
        )}
        <button
          className={`star ${item.starred ? "on" : ""}`}
          title={item.starred ? "Unstar" : "Star"}
          onClick={(e) => { e.stopPropagation(); actions.toggleStar(item.id); }}
        >
          {item.starred ? "★" : "☆"}
        </button>
      </div>
      {isFolder && open &&
        childrenOf(ws.items, item.id).map((c) => <Row key={c.id} item={c} depth={depth + 1} ctx={ctx} />)}
    </>
  );
}

export default function Sidebar({ ws, actions, onImport, onBackup, onRestore }) {
  const [query, setQuery] = useState("");
  const [renamingId, setRenamingId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [dropTarget, setDropTarget] = useState(null);

  const create = (fn, parent) => {
    const id = fn(parent);
    setRenamingId(id);
  };

  const openMenu = (e, item) => {
    const entries = [
      { label: "Rename", run: () => setRenamingId(item.id) },
      { label: "Duplicate", run: () => actions.duplicate(item.id) },
      { label: item.starred ? "Unstar" : "Star", run: () => actions.toggleStar(item.id) },
    ];
    if (item.type === "folder") {
      entries.push("-",
        { label: "New drawing here", run: () => create(actions.createFile, item.id) },
        { label: "New subfolder", run: () => create(actions.createFolder, item.id) });
    }
    if (item.parentId) entries.push("-", { label: "Move to top level", run: () => actions.move(item.id, null) });
    entries.push("-", {
      label: "Delete",
      danger: true,
      run: () => {
        const what = item.type === "folder" ? `folder "${item.name}" and everything in it` : `"${item.name}"`;
        if (window.confirm(`Delete ${what}? This cannot be undone.`)) actions.remove(item.id);
      },
    });
    setMenu({ x: Math.min(e.clientX, window.innerWidth - 190), y: Math.min(e.clientY, window.innerHeight - 260), entries });
  };

  const ctx = { ws, actions, renamingId, setRenamingId, openMenu, dragId, setDragId, dropTarget, setDropTarget };

  const q = query.trim().toLowerCase();
  const matches = useMemo(
    () => (q ? Object.values(ws.items).filter((i) => i.name.toLowerCase().includes(q)) : []),
    [q, ws.items],
  );
  const starred = Object.values(ws.items).filter((i) => i.starred);

  return (
    <aside className="sidebar">
      <div className="side-head">
        <button className="btn primary" onClick={() => create(actions.createFile, null)}>＋ New drawing</button>
        <button className="btn" title="New folder" onClick={() => create(actions.createFolder, null)}>📁＋</button>
      </div>
      <input className="search" placeholder="Search files…" value={query} onChange={(e) => setQuery(e.target.value)} />

      <div
        className={`tree ${dropTarget === "root" ? "drop" : ""}`}
        onDragOver={(e) => { if (dragId) { e.preventDefault(); setDropTarget("root"); } }}
        onDrop={(e) => { if (dragId) { e.preventDefault(); actions.move(dragId, null); setDragId(null); setDropTarget(null); } }}
      >
        {q ? (
          <>
            <div className="section">Results ({matches.length})</div>
            {matches.map((i) => (
              <div key={i.id} className="row" onClick={() => (i.type === "file" ? actions.openFile(i.id) : actions.toggleFolder(i.id))}>
                <span className="ico">{i.type === "folder" ? "📁" : "✏️"}</span>
                <span className="name" title={pathOf(ws.items, i.id)}>{pathOf(ws.items, i.id)}</span>
              </div>
            ))}
            {!matches.length && <div className="empty">No matches</div>}
          </>
        ) : (
          <>
            {starred.length > 0 && (
              <>
                <div className="section">Starred</div>
                {starred.map((i) => (
                  <div key={i.id} className="row" onClick={() => (i.type === "file" ? actions.openFile(i.id) : actions.toggleFolder(i.id))}>
                    <span className="ico">{i.type === "folder" ? "📁" : "✏️"}</span>
                    <span className="name">{i.name}</span>
                  </div>
                ))}
              </>
            )}
            <div className="section">Files</div>
            {childrenOf(ws.items, null).map((i) => <Row key={i.id} item={i} depth={0} ctx={ctx} />)}
            {!Object.keys(ws.items).length && <div className="empty">No files yet. Create your first drawing!</div>}
          </>
        )}
      </div>

      <div className="side-foot">
        <button className="btn" onClick={onImport} title="Import .excalidraw / .json / .png files">⬆ Import</button>
        <button className="btn" onClick={onBackup} title="Download a backup of the whole workspace">💾 Backup</button>
        <button className="btn" onClick={onRestore} title="Restore workspace from backup">♻ Restore</button>
      </div>
      <ContextMenu menu={menu} onClose={() => setMenu(null)} />
    </aside>
  );
}
