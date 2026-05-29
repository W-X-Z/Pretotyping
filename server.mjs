import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function resolvePath(url) {
  const path = new URL(url, `http://localhost:${port}`).pathname;
  const safePath = normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, "");
  return join(root, safePath === "/" ? "index.html" : safePath);
}

createServer(async (req, res) => {
  try {
    const file = resolvePath(req.url || "/");
    const body = await readFile(file);
    res.writeHead(200, {
      "content-type": types[extname(file)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    res.end(body);
  } catch {
    const body = await readFile(join(root, "index.html"));
    res.writeHead(200, { "content-type": types[".html"], "cache-control": "no-store" });
    res.end(body);
  }
}).listen(port, () => {
  console.log(`Pretotyping MVP running at http://localhost:${port}`);
});
