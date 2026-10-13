import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadWorkspace,
  saveWorkspace,
  loadScene,
  saveScene,
  deleteFileData,
} from "./storage";

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const now = () => Date.now();

const emptyWorkspace = () => ({
  items: {},
  tabs: [],
  activeId: null,
  expanded: {},
  theme: "light",
  sidebarOpen: true,
  view: "editor", // "editor" | "overview"
});

/** All descendant ids of a folder (not including itself). */
export function descendants(items, id) {
  const out = [];
  const walk = (pid) => {
    for (const it of Object.values(items)) {
      if (it.parentId === pid) {
        out.push(it.id);
        if (it.type === "folder") walk(it.id);
      }
    }
  };
  walk(id);
  return out;
}

/** Sorted children: folders first, then by name. */
export function childrenOf(items, parentId) {
  return Object.values(items)
    .filter((i) => i.parentId === parentId)
    .sort((a, b) =>
      a.type !== b.type
        ? a.type === "folder"
          ? -1
          : 1
        : a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }),
    );
}

export function pathOf(items, id) {
  const parts = [];
  let cur = items[id];
  while (cur) {
    parts.unshift(cur.name);
    cur = cur.parentId ? items[cur.parentId] : null;
  }
  return parts.join(" / ");
}

export function useWorkspace() {
  const [ws, setWs] = useState(null);
  const loaded = useRef(false);
  const wsRef = useRef(null);
  wsRef.current = ws;

  useEffect(() => {
    let cancelled = false;
    loadWorkspace()
      .then((saved) => {
        if (cancelled) return;
        loaded.current = true;
        setWs(saved ? { ...emptyWorkspace(), ...saved } : seedWorkspace());
      })
      .catch(() => {
        loaded.current = true;
        setWs(seedWorkspace());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced persistence of the workspace tree/tabs/settings.
  useEffect(() => {
    if (!ws || !loaded.current) return;
    const t = setTimeout(() => saveWorkspace(ws), 250);
    return () => clearTimeout(t);
  }, [ws]);

  const update = useCallback((fn) => setWs((prev) => (prev ? fn(prev) : prev)), []);

  const actions = {
    replaceAll: (next) => setWs({ ...emptyWorkspace(), ...next }),

    createFile(parentId = null, name = "Untitled drawing") {
      const id = uid();
      update((s) => ({
        ...s,
        items: {
          ...s.items,
          [id]: { id, type: "file", name, parentId, starred: false, createdAt: now(), updatedAt: now(), elementCount: 0 },
        },
        expanded: parentId ? { ...s.expanded, [parentId]: true } : s.expanded,
        tabs: [...s.tabs, id],
        activeId: id,
        view: "editor",
      }));
      return id;
    },

    createFolder(parentId = null, name = "New folder") {
      const id = uid();
      update((s) => ({
        ...s,
        items: {
          ...s.items,
          [id]: { id, type: "folder", name, parentId, starred: false, createdAt: now(), updatedAt: now() },
        },
        expanded: { ...s.expanded, ...(parentId ? { [parentId]: true } : {}), [id]: true },
      }));
      return id;
    },

    rename(id, name) {
      const clean = name.trim();
      if (!clean) return;
      update((s) => ({ ...s, items: { ...s.items, [id]: { ...s.items[id], name: clean } } }));
    },

    toggleStar(id) {
      update((s) => ({
        ...s,
        items: { ...s.items, [id]: { ...s.items[id], starred: !s.items[id].starred } },
      }));
    },

    touch(id, patch) {
      update((s) =>
        s.items[id] ? { ...s, items: { ...s.items, [id]: { ...s.items[id], ...patch, updatedAt: now() } } } : s,
      );
    },

    async remove(id) {
      const s = wsRef.current;
      if (!s?.items[id]) return;
      const all = [id, ...descendants(s.items, id)];
      const fileIds = all.filter((x) => s.items[x]?.type === "file");
      update((cur) => {
        const items = { ...cur.items };
        all.forEach((x) => delete items[x]);
        const tabs = cur.tabs.filter((t) => !all.includes(t));
        let activeId = cur.activeId;
        if (all.includes(activeId)) {
          const idx = cur.tabs.indexOf(activeId);
          activeId = tabs[Math.min(idx, tabs.length - 1)] ?? null;
        }
        return { ...cur, items, tabs, activeId };
      });
      await Promise.all(fileIds.map(deleteFileData));
    },

    async duplicate(id) {
      const s = wsRef.current;
      if (!s?.items[id]) return;
      const items = {};
      const copies = [];
      const clone = (srcId, parentId, isRoot) => {
        const src = s.items[srcId];
        const newId = uid();
        items[newId] = {
          ...src,
          id: newId,
          parentId,
          name: isRoot ? `${src.name} (copy)` : src.name,
          createdAt: now(),
          updatedAt: now(),
        };
        if (src.type === "file") copies.push([srcId, newId]);
        else Object.values(s.items).filter((c) => c.parentId === srcId).forEach((c) => clone(c.id, newId, false));
        return newId;
      };
      const newRoot = clone(id, s.items[id].parentId, true);
      // Copy scene data first so the editor finds it when the new tab opens.
      await Promise.all(
        copies.map(async ([from, to]) => {
          const scene = await loadScene(from);
          if (scene) await saveScene(to, scene);
        }),
      );
      const isFile = items[newRoot].type === "file";
      update((cur) => ({
        ...cur,
        items: { ...cur.items, ...items },
        tabs: isFile ? [...cur.tabs, newRoot] : cur.tabs,
        activeId: isFile ? newRoot : cur.activeId,
        view: isFile ? "editor" : cur.view,
      }));
    },

    move(id, newParentId) {
      update((s) => {
        const item = s.items[id];
        if (!item || item.parentId === newParentId) return s;
        if (newParentId === id || (newParentId && descendants(s.items, id).includes(newParentId))) return s;
        return {
          ...s,
          items: { ...s.items, [id]: { ...item, parentId: newParentId } },
          expanded: newParentId ? { ...s.expanded, [newParentId]: true } : s.expanded,
        };
      });
    },

    openFile(id) {
      update((s) => ({
        ...s,
        tabs: s.tabs.includes(id) ? s.tabs : [...s.tabs, id],
        activeId: id,
        view: "editor",
      }));
    },

    closeTab(id) {
      update((s) => {
        const tabs = s.tabs.filter((t) => t !== id);
        let activeId = s.activeId;
        if (activeId === id) {
          const idx = s.tabs.indexOf(id);
          activeId = tabs[Math.min(idx, tabs.length - 1)] ?? null;
        }
        return { ...s, tabs, activeId };
      });
    },

    setActive: (id) => update((s) => ({ ...s, activeId: id, view: "editor" })),
    toggleFolder: (id) => update((s) => ({ ...s, expanded: { ...s.expanded, [id]: !s.expanded[id] } })),
    setTheme: (theme) => update((s) => ({ ...s, theme })),
    toggleSidebar: () => update((s) => ({ ...s, sidebarOpen: !s.sidebarOpen })),
    setView: (view) => update((s) => ({ ...s, view })),

    /** Create files from imported scenes: [{ name, scene }] */
    async importScenes(list, parentId = null) {
      const ids = [];
      const entries = list.map(({ name, scene }) => {
        const id = uid();
        ids.push(id);
        return { id, name, scene };
      });
      await Promise.all(entries.map((e) => saveScene(e.id, e.scene)));
      update((s) => {
        const items = { ...s.items };
        entries.forEach((e) => {
          items[e.id] = {
            id: e.id, type: "file", name: e.name, parentId, starred: false,
            createdAt: now(), updatedAt: now(),
            elementCount: e.scene.elements.filter((x) => !x.isDeleted).length,
          };
        });
        return { ...s, items, tabs: [...s.tabs, ...ids], activeId: ids[ids.length - 1] ?? s.activeId, view: "editor" };
      });
      return ids;
    },
  };

  return { ws, actions };
}

function seedWorkspace() {
  const base = emptyWorkspace();
  const folder = uid();
  const file = uid();
  base.items[folder] = { id: folder, type: "folder", name: "My drawings", parentId: null, starred: false, createdAt: now(), updatedAt: now() };
  base.items[file] = { id: file, type: "file", name: "Welcome", parentId: folder, starred: false, createdAt: now(), updatedAt: now(), elementCount: 0 };
  base.expanded[folder] = true;
  base.tabs = [file];
  base.activeId = file;
  return base;
}
