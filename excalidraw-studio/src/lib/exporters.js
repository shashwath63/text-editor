import {
  serializeAsJSON,
  exportToBlob,
  exportToSvg,
  loadFromBlob,
} from "@excalidraw/excalidraw";

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const safe = (name) => name.replace(/[\\/:*?"<>|]+/g, "_").trim() || "drawing";

const snapshot = (api) => ({
  elements: api.getSceneElements(),
  appState: api.getAppState(),
  files: api.getFiles(),
});

export function exportExcalidraw(api, name) {
  const { elements, appState, files } = snapshot(api);
  const json = serializeAsJSON(elements, appState, files, "local");
  download(new Blob([json], { type: "application/json" }), `${safe(name)}.excalidraw`);
}

export async function exportPng(api, name) {
  const { elements, appState, files } = snapshot(api);
  const blob = await exportToBlob({
    elements,
    appState: { ...appState, exportBackground: true, exportWithDarkMode: appState.theme === "dark" },
    files,
    mimeType: "image/png",
    exportPadding: 24,
  });
  download(blob, `${safe(name)}.png`);
}

export async function exportSvg(api, name) {
  const { elements, appState, files } = snapshot(api);
  const svg = await exportToSvg({
    elements,
    appState: { ...appState, exportBackground: true, exportWithDarkMode: appState.theme === "dark" },
    files,
    exportPadding: 24,
  });
  download(new Blob([svg.outerHTML], { type: "image/svg+xml" }), `${safe(name)}.svg`);
}

/** Small SVG data-URL used for the overview grid. */
export async function makeThumbnail(elements, appState, files) {
  const live = elements.filter((e) => !e.isDeleted);
  if (!live.length) return null;
  const svg = await exportToSvg({
    elements: live,
    appState: { ...appState, exportBackground: true, exportWithDarkMode: false },
    files,
    exportPadding: 12,
    skipInliningFonts: true,
  });
  svg.setAttribute("width", "320");
  svg.removeAttribute("height");
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.outerHTML);
}

/** Parse a .excalidraw / .json / embedded-scene .png / .svg file into a stored scene. */
export async function readSceneFile(file) {
  const data = await loadFromBlob(file, null, null);
  const a = data.appState || {};
  return {
    elements: data.elements,
    files: data.files || {},
    appState: {
      viewBackgroundColor: a.viewBackgroundColor || "#ffffff",
      gridModeEnabled: !!a.gridModeEnabled,
    },
  };
}
