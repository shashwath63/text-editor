export default function Tabs({ ws, actions }) {
  return (
    <div className="tabs">
      {ws.tabs.map((id) => {
        const item = ws.items[id];
        if (!item) return null;
        const active = ws.activeId === id && ws.view === "editor";
        return (
          <div
            key={id}
            className={`tab ${active ? "active" : ""}`}
            onClick={() => actions.setActive(id)}
            onMouseDown={(e) => { if (e.button === 1) { e.preventDefault(); actions.closeTab(id); } }}
            title={item.name}
          >
            <span className="tab-name">{item.name}</span>
            <button className="x" onClick={(e) => { e.stopPropagation(); actions.closeTab(id); }} title="Close tab (Alt+W)">×</button>
          </div>
        );
      })}
    </div>
  );
}
