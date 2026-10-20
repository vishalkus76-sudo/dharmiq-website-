// Copy only public website files. No credentials, databases or server source is deployed.
import { mkdirSync, rmSync, cpSync, readdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, "dist");
rmSync(output, { recursive: true, force: true });
mkdirSync(resolve(output, "assets"), { recursive: true });
for (const file of ["index.html", "chadhava.html"])
  cpSync(resolve(root, file), resolve(output, file));
for (const file of [
  "app.js",
  "booking.js",
  "chadhava.js",
  "styles.css",
  "catalog.json",
])
  cpSync(resolve(root, "assets", file), resolve(output, "assets", file));
for (const file of readdirSync(root))
  if (/\.(png|jpe?g|webp|mp4)$/i.test(file))
    cpSync(resolve(root, file), resolve(output, file));
console.log("Static website built in dist/");
