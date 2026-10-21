import { mkdir, rm, copyFile, cp } from "node:fs/promises";
const media = [
  "111032106.webp",
  "Dharmique Logo.png",
  "WhatsApp Image 2026-10-11 at 8.02.15 PM.jpeg",
  "WhatsApp Image 2026-10-15 at 10.20.58 AM.jpeg",
  "WhatsApp Image 2026-10-15 at 10.21.05 AM.jpeg",
  "images.jpg",
  "turn_into_video_20261012133732.mp4",
];
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of ["index.html", "chadhava.html", "admin.html", ...media])
  await copyFile(file, `dist/${file}`);
await cp("assets", "dist/assets", { recursive: true });
console.log("Public website built in dist; private server files excluded.");
