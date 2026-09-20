import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const out = new URL("./dist/", import.meta.url);
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
await Promise.all([
  build({ entryPoints: [fileURLToPath(new URL("./src/popup.ts", import.meta.url))], bundle: true, outfile: fileURLToPath(new URL("./dist/popup.js", import.meta.url)), format: "iife", target: "chrome120" }),
  build({ entryPoints: [fileURLToPath(new URL("./src/background.ts", import.meta.url))], bundle: true, outfile: fileURLToPath(new URL("./dist/background.js", import.meta.url)), format: "iife", target: "chrome120" }),
  build({ entryPoints: [fileURLToPath(new URL("./src/content.ts", import.meta.url))], bundle: true, outfile: fileURLToPath(new URL("./dist/content.js", import.meta.url)), format: "iife", target: "chrome120" }),
  build({ entryPoints: [fileURLToPath(new URL("./src/problemset.ts", import.meta.url))], bundle: true, outfile: fileURLToPath(new URL("./dist/problemset.js", import.meta.url)), format: "iife", target: "chrome120" }),
  build({ entryPoints: [fileURLToPath(new URL("./src/app-bridge.ts", import.meta.url))], bundle: true, outfile: fileURLToPath(new URL("./dist/app-bridge.js", import.meta.url)), format: "iife", target: "chrome120" }),
]);
await Promise.all([
  cp(new URL("./manifest.json", import.meta.url), new URL("./dist/manifest.json", import.meta.url)),
  cp(new URL("./popup.html", import.meta.url), new URL("./dist/popup.html", import.meta.url)),
  cp(new URL("./popup.css", import.meta.url), new URL("./dist/popup.css", import.meta.url)),
  cp(new URL("../public/sprout-pet.png", import.meta.url), new URL("./dist/sprout-pet.png", import.meta.url)),
]);
console.log("Extension built in extension/dist");
