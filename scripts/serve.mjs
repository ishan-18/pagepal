// Minimal server for the demo and e2e tests (no dependencies). Usage: node scripts/serve.mjs [port]
//   /api/*     answers after 2 seconds (500 if the path contains "fail"), so requests are visibly slow
//   /collect   POST: store analytics batches ({"events":[...]}) in memory; GET: list them; DELETE: clear
//   anything else: static files from the project root ("/" is the demo)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const port = Number(process.argv[2] ?? 5173);
const types = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.map': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const MAX_EVENTS = 5000;
let collected = [];

const readBody = (req) =>
  new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      if (body.length < 1_000_000) body += chunk;
    });
    req.on('end', () => resolve(body));
  });

const json = (res, status, data) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(data));

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (path === '/collect') {
    if (req.method === 'POST') {
      try {
        const { events } = JSON.parse(await readBody(req));
        if (Array.isArray(events)) collected = collected.concat(events).slice(-MAX_EVENTS);
      } catch {
        return json(res, 400, { error: 'expected {"events":[...]}' });
      }
      return res.writeHead(204).end();
    }
    if (req.method === 'DELETE') {
      collected = [];
      return res.writeHead(204).end();
    }
    return json(res, 200, { events: collected });
  }

  if (path.startsWith('/api/')) {
    await readBody(req); // drain uploads so upload progress completes
    setTimeout(() => {
      const status = path.includes('fail') ? 500 : 200;
      json(res, status, { ok: status === 200 });
    }, 2000);
    return;
  }

  const file = normalize(join(root, path === '/' ? 'demo/index.html' : path));
  if (!file.startsWith(root.endsWith(sep) ? root : root + sep)) return res.writeHead(403).end();
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`pagepal demo: http://localhost:${port}/`));
