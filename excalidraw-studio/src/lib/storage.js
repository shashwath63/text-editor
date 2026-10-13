import { get, set, del, getMany, keys } from "idb-keyval";

const WORKSPACE_KEY = "studio:workspace:v1";
const sceneKey = (id) => `studio:scene:${id}`;
const thumbKey = (id) => `studio:thumb:${id}`;

export const loadWorkspace = () => get(WORKSPACE_KEY);
export const saveWorkspace = (ws) => set(WORKSPACE_KEY, ws);

export const loadScene = (id) => get(sceneKey(id));
export const saveScene = (id, scene) => set(sceneKey(id), scene);
export const loadThumb = (id) => get(thumbKey(id));
export const saveThumb = (id, dataUrl) => set(thumbKey(id), dataUrl);

export const deleteFileData = (id) => Promise.all([del(sceneKey(id)), del(thumbKey(id))]);

export async function loadThumbs(ids) {
  const values = await getMany(ids.map(thumbKey));
  return Object.fromEntries(ids.map((id, i) => [id, values[i]]));
}

/** Everything needed to rebuild the workspace on another machine. */
export async function exportBackup(workspace) {
  const ids = Object.values(workspace.items)
    .filter((i) => i.type === "file")
    .map((i) => i.id);
  const scenes = await getMany(ids.map(sceneKey));
  return {
    type: "excalidraw-studio-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    workspace,
    scenes: Object.fromEntries(ids.map((id, i) => [id, scenes[i] || null])),
  };
}

export async function restoreBackup(backup) {
  if (backup?.type !== "excalidraw-studio-backup" || !backup.workspace?.items) {
    throw new Error("Not a valid Excalidraw Studio backup file.");
  }
  const existing = await keys();
  await Promise.all(
    existing.filter((k) => typeof k === "string" && k.startsWith("studio:")).map((k) => del(k)),
  );
  await Promise.all(
    Object.entries(backup.scenes || {}).map(([id, scene]) => scene && saveScene(id, scene)),
  );
  await saveWorkspace(backup.workspace);
  return backup.workspace;
}
