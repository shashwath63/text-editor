import { useEffect, useRef, useState } from "react";
import { Excalidraw, MainMenu } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import { loadScene, saveScene, saveThumb } from "../lib/storage";
import { makeThumbnail } from "../lib/exporters";

const SAVE_DELAY = 600;

const signature = (elements, appState, files) =>
  elements.map((e) => `${e.id}:${e.version}`).join(",") +
  `|${appState.viewBackgroundColor}|${appState.gridModeEnabled}|${Object.keys(files || {}).length}`;

/**
 * One editor instance per file. The parent mounts it with key={file.id}, so
 * switching tabs unmounts (and flushes) the previous scene.
 */
export default function Editor({ file, theme, onApi, onSaved, onStatus }) {
  const [initial, setInitial] = useState(undefined); // undefined = loading
  const latest = useRef(null);
  const lastSig = useRef("");
  const timer = useRef(null);
  const apiRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    loadScene(file.id).then((scene) => {
      if (cancelled) return;
      const data = scene || { elements: [], appState: {}, files: {} };
      lastSig.current = signature(data.elements, data.appState || {}, data.files);
      setInitial(data);
    });
    return () => {
      cancelled = true;
    };
  }, [file.id]);

  const flush = async () => {
    clearTimeout(timer.current);
    const cur = latest.current;
    if (!cur) return;
    latest.current = null;
    const { elements, appState, files } = cur;
    const scene = {
      elements,
      files,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        gridModeEnabled: appState.gridModeEnabled,
        scrollX: appState.scrollX,
        scrollY: appState.scrollY,
        zoom: appState.zoom,
      },
    };
    try {
      await saveScene(file.id, scene);
      const count = elements.filter((e) => !e.isDeleted).length;
      onSaved(file.id, count);
      onStatus("saved");
      const thumb = await makeThumbnail(elements, appState, files);
      if (thumb) await saveThumb(file.id, thumb);
    } catch (err) {
      console.error("Save failed", err);
      onStatus("error");
    }
  };

  // Flush on unmount (tab switch / close) and when the page is hidden or closed.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    const onHide = () => flushRef.current();
    window.addEventListener("beforeunload", onHide);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", onHide);
      document.removeEventListener("visibilitychange", onHide);
      flushRef.current();
      onApi(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChange = (elements, appState, files) => {
    const sig = signature(elements, appState, files);
    if (sig === lastSig.current) return;
    lastSig.current = sig;
    latest.current = { elements, appState, files };
    onStatus("saving");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => flushRef.current(), SAVE_DELAY);
  };

  if (initial === undefined) return <div className="center-note">Loading…</div>;

  return (
    <Excalidraw
      excalidrawAPI={(api) => {
        apiRef.current = api;
        onApi(api);
      }}
      initialData={{
        elements: initial.elements,
        files: initial.files,
        appState: { ...initial.appState, collaborators: new Map() },
        scrollToContent: !initial.appState?.zoom && initial.elements.length > 0,
      }}
      theme={theme}
      onChange={handleChange}
      UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
    >
      <MainMenu>
        <MainMenu.DefaultItems.SaveAsImage />
        <MainMenu.DefaultItems.Export />
        <MainMenu.DefaultItems.ClearCanvas />
        <MainMenu.Separator />
        <MainMenu.DefaultItems.ChangeCanvasBackground />
        <MainMenu.DefaultItems.Help />
      </MainMenu>
    </Excalidraw>
  );
}
