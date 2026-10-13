# Excalidraw Studio

A local, multi-file workspace built on the official [`@excalidraw/excalidraw`](https://www.npmjs.com/package/@excalidraw/excalidraw) SDK.
Everything is stored in your browser's IndexedDB. No server and no account needed, and it works offline.

## Run it

```bash
cd excalidraw-studio
npm install
npm run dev        # opens http://localhost:5173
```

Production build: `npm run build && npm run preview`.

## Features

- **Many drawings**: file tree with nested folders, inline rename (double-click), duplicate, star, delete, and drag & drop to move.
- **Tabs**: keep several drawings open (`Alt+←/→` to switch, middle-click or `Alt+W` to close).
- **Autosave** to IndexedDB, including pasted images, grid and background settings, and scroll/zoom per file.
- **Overview**: thumbnail gallery of all drawings, sorted by last edit.
- **Search** the tree, or use the **command palette** (`Ctrl/Cmd+K`) to jump to any drawing or run an action.
- **Import** `.excalidraw`, `.json` and scene-embedded `.png`/`.svg` files (several at once). **Export** the current drawing as `.excalidraw`, PNG or SVG.
- **Backup / Restore** the entire workspace as one JSON file (move it between machines).
- Light/dark theme, collapsible sidebar (`Ctrl/Cmd+B`), `Alt+N` for a new drawing.
- Excalidraw fonts are bundled locally (copied to `public/` by `scripts/copy-assets.mjs`).

## Layout

```
src/
  App.jsx                 shell, shortcuts, import/export wiring
  lib/storage.js          IndexedDB access + backup/restore
  lib/workspace.js        workspace state hook (tree, tabs, settings)
  lib/exporters.js        .excalidraw / PNG / SVG / thumbnails / import
  components/             Sidebar, Tabs, Editor, Overview, CommandPalette
```
