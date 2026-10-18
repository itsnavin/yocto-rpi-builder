import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json" };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const target = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!target.startsWith(root) || ![".html", ".js", ".css", ".json"].includes(path.extname(target))) {
      res.writeHead(404).end("Not found"); return;
    }
    const content = await readFile(target);
    res.writeHead(200, { "Content-Type": `${types[path.extname(target)]}; charset=utf-8`, "Cache-Control": "no-store" });
    res.end(content);
  } catch (error) {
    if (!res.headersSent) res.writeHead(404);
    res.end("Unable to read file");
    if (error.code !== "ENOENT") console.error(error);
  }
});
server.listen(4173, "127.0.0.1", () => console.log("Preview: http://127.0.0.1:4173"));
