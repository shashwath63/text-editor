import { useEffect, useState } from "react";
import { loadThumbs } from "../lib/storage";
import { pathOf } from "../lib/workspace";

const ago = (t) => {
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(t).toLocaleDateString();
};

export default function Overview({ ws, actions }) {
  const files = Object.values(ws.items)
    .filter((i) => i.type === "file")
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const [thumbs, setThumbs] = useState({});
  const key = files.map((f) => f.id + f.updatedAt).join();

  useEffect(() => {
    let alive = true;
    loadThumbs(files.map((f) => f.id)).then((t) => alive && setThumbs(t));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return (
    <div className="overview">
      <h2>All drawings <span className="muted">({files.length})</span></h2>
      {!files.length && <div className="center-note">No drawings yet.</div>}
      <div className="grid">
        {files.map((f) => (
          <div key={f.id} className="card" onClick={() => actions.openFile(f.id)}>
            <div className="thumb">
              {thumbs[f.id] ? <img src={thumbs[f.id]} alt="" /> : <span className="muted">Empty</span>}
            </div>
            <div className="meta">
              <div className="title">{f.starred ? "★ " : ""}{f.name}</div>
              <div className="muted small">{pathOf(ws.items, f.parentId || "") || "Top level"}</div>
              <div className="muted small">{f.elementCount ?? 0} elements · {ago(f.updatedAt)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
