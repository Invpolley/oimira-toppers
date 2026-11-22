// Servidor estático mínimo para las pruebas. Uso: import { servir } from "./servidor.mjs"
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
const TIPOS = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".png": "image/png", ".css": "text/css", ".ttf": "font/ttf", ".3mf": "model/3mf" };
export function servir(raiz){
  return new Promise((res) => {
    const srv = http.createServer((req, r) => {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
      const f = path.join(raiz, path.normalize(p).replace(/^(\.\.[\/\\])+/, ""));
      fs.readFile(f, (e, d) => {
        if (e){ r.writeHead(404, { "content-type": "text/plain" }); return r.end("404"); }
        r.writeHead(200, { "content-type": TIPOS[path.extname(f)] || "application/octet-stream", "cache-control": "no-store" }); r.end(d);
      });
    });
    srv.listen(0, "127.0.0.1", () => res({ url: "http://127.0.0.1:" + srv.address().port + "/", cerrar: () => srv.close() }));
  });
}
