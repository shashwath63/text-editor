// Copies Excalidraw's fonts into public/ so the app works fully offline.
import { cpSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules/@excalidraw/excalidraw/dist/prod/fonts");
const dest = path.join(root, "public/excalidraw-assets/fonts");

if (!existsSync(src)) {
  console.warn("[copy-assets] Excalidraw fonts not found, run `npm install` first.");
  process.exit(0);
}
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log("[copy-assets] fonts copied to", path.relative(root, dest));
