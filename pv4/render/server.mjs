// 极简静态服务器（ES module 需要 http 而非 file://）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.woff2': 'font/woff2', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.png': 'image/png' };
export function serve(root) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!p.startsWith(root)) { rsp.writeHead(403); return rsp.end(); }
      fs.readFile(p.endsWith('/') ? p + 'index.html' : p, (err, buf) => {
        if (err) { rsp.writeHead(404); return rsp.end(); }
        rsp.writeHead(200, { 'Content-Type': TYPES[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        rsp.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}
