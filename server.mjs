// Optional local preview server. Production deploys only the static dist folder.
import http from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const base = existsSync(resolve(root, "dist/index.html"))
  ? resolve(root, "dist")
  : root;
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".mp4": "video/mp4",
};
http
  .createServer((req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    try {
      if (!["GET", "HEAD"].includes(req.method)) {
        res.writeHead(405);
        return res.end();
      }
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      const name = path === "/" ? "index.html" : path.slice(1);
      if (
        !/^(index\.html|chadhava\.html|assets\/(app\.js|booking\.js|chadhava\.js|styles\.css|catalog\.json)|[^/.][^/]*\.(png|jpeg|jpg|webp|mp4))$/.test(
          name,
        )
      ) {
        res.writeHead(404);
        return res.end("Not found");
      }
      const file = resolve(base, name);
      if (!existsSync(file) || !statSync(file).isFile()) {
        res.writeHead(404);
        return res.end("Not found");
      }
      res.setHeader(
        "Content-Type",
        types[extname(file)] || "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-cache");
      // Byte ranges allow the existing gallery video to seek without downloading it all.
      const size = statSync(file).size;
      if (req.headers.range && extname(file) === ".mp4") {
        const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range);
        const start = match ? Number(match[1]) : NaN,
          end = match?.[2] ? Number(match[2]) : size - 1;
        if (
          !Number.isSafeInteger(start) ||
          !Number.isSafeInteger(end) ||
          start > end ||
          end >= size
        ) {
          res.writeHead(416, { "Content-Range": `bytes */${size}` });
          return res.end();
        }
        res.writeHead(206, {
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
        });
        return res.end(
          req.method === "HEAD"
            ? undefined
            : readFileSync(file).subarray(start, end + 1),
        );
      }
      res.writeHead(200, { "Content-Length": size, "Accept-Ranges": "bytes" });
      res.end(req.method === "HEAD" ? undefined : readFileSync(file));
    } catch {
      res.writeHead(400);
      res.end("Bad request");
    }
  })
  .listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log("Dharmique static preview ready"),
  );
