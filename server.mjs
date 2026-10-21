import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { api } from "./lib/api.js";
import config from "./vercel.json" with { type: "json" };
const root = fileURLToPath(new URL(".", import.meta.url));
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
};
export const server = http.createServer(async (req, res) => {
  let path;
  try {
    path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
  } catch {
    res.writeHead(400);
    return res.end();
  }
  if (path.startsWith("/api/")) return api(req, res, path.slice(5));
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405);
    return res.end();
  }
  const file = path === "/" ? "index.html" : path.slice(1);
  if (
    !/^(index\.html|chadhava\.html|admin\.html|assets\/[a-z-]+\.(js|css)|[^/.][^/]*\.(png|webp|jpeg|jpg|mp4))$/.test(
      file,
    )
  ) {
    res.writeHead(404);
    return res.end();
  }
  try {
    const data = await readFile(resolve(root, file));
    res.setHeader(
      "Content-Type",
      mime[extname(file)] || "application/octet-stream",
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (file === "admin.html")
      for (const header of config.headers[0].headers)
        res.setHeader(header.key, header.value);
    res.setHeader("Content-Length", data.length);
    res.writeHead(200);
    res.end(req.method === "HEAD" ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end();
  }
});
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  server.listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("Dharmique preview ready"),
  );
}
