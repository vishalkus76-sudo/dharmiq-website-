import { mkdir, rm, copyFile, cp } from "node:fs/promises";
const media = [
  "jagannath-hero.png",
  "jagannath-five-deep.jpg",
  "jagannath-eleven-deep.jpg",
  "jagannath-deep-bhog.jpg",
  "laghu-prasadi.jpg",
  "madhyann-bhog.jpg",
  "rajbhog-seva.jpg",

  "kashi-hero.jpg",
  "chadhava-seva.jpg",
  "ganga-pujan.jpg",
  "kashi-prasadi-box.jpg",
  "dev-deepawali.jpg",
  "mahadev-chadhava.jpg",
  "kashi-vishwanath.jpg",
  "durga-kund.jpg",
  "sankat-mochan.jpg",
  "kashi-char-dham.jpg",

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
