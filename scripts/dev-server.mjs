import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { evaluateHousehold } from '../lib/benefits.mjs';

const root = new URL('../public/', import.meta.url).pathname;
const port = Number(process.env.PORT || 8888);
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

const server = http.createServer(async (req, res) => {
  if (req.url === '/api/evaluate' && req.method === 'POST') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const parsed = JSON.parse(body || '{}');
      const result = evaluateHousehold(parsed.household || parsed);
      res.writeHead(result.ok ? 200 : 400, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      return res.end(JSON.stringify(result));
    } catch {
      res.writeHead(400, { 'content-type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }));
    }
  }

  const requested = req.url === '/' ? '/index.html' : (req.url || '/index.html').split('?')[0];
  const safe = normalize(requested).replace(/^([.][.][/\\])+/, '');
  const file = join(root, safe);
  if (!file.startsWith(root)) {
    res.writeHead(403); return res.end('Forbidden');
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(port, () => console.log(`Benefit Bridge dev server: http://localhost:${port}`));
