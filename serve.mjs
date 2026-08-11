// serve.mjs — the little static server this app needs in order to run at all.
//
// Kotoba Lab uses ES modules and fetches its dictionaries from data/, and a
// browser blocks both over file://. This serves the folder over http instead.
//
// No dependencies, on purpose: `npx serve` has to reach the network the first
// time, and the whole point of this tool is that it works on a plane. Node's
// own http + fs are enough.
//
//   node serve.mjs           serve this folder, pick a port, open the browser
//   node serve.mjs 8080      insist on a port
//   node serve.mjs --no-open just serve

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const args = process.argv.slice(2);
const OPEN = !args.includes('--no-open');
const FIRST_PORT = Number(args.find((a) => /^\d+$/.test(a))) || 5506;
const PORT_ATTEMPTS = 20;

// `.js` MUST be a JavaScript type or the browser refuses the module script and
// the page loads dead — the same failure file:// gives, for a different reason.
const TYPES = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript',
  '.mjs': 'text/javascript', '.json': 'application/json', '.map': 'application/json',
  '.txt': 'text/plain', '.md': 'text/markdown', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  // kuromoji ships its dictionary as .dat.gz and gunzips it ITSELF. Serving
  // these with `Content-Encoding: gzip` would make the browser decompress them
  // first, and kuromoji would then fail trying to unzip plain data. So: a
  // gzip content TYPE, and deliberately no content ENCODING.
  '.gz': 'application/gzip',
};

const send = (res, status, body, headers = {}) => {
  res.writeHead(status, { 'Cache-Control': 'no-cache', ...headers });
  res.end(body);
};

const server = createServer(async (req, res) => {
  try {
    let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (path.endsWith('/')) path += 'index.html';

    // Keep the server inside its own folder: normalize first, then confirm the
    // resolved path still starts at ROOT, so ../ can't climb out.
    const full = normalize(join(ROOT, path));
    if (!full.startsWith(ROOT.endsWith(sep) ? ROOT : ROOT + sep)) {
      return send(res, 403, 'Forbidden');
    }

    const info = await stat(full).catch(() => null);
    if (!info) return send(res, 404, `Not found: ${path}`, { 'Content-Type': 'text/plain; charset=utf-8' });
    if (info.isDirectory()) return send(res, 302, '', { Location: path + '/' });

    const type = TYPES[extname(full).toLowerCase()] || 'application/octet-stream';
    const charset = type.startsWith('text/') || type === 'application/json' ? '; charset=utf-8' : '';
    send(res, 200, await readFile(full), { 'Content-Type': type + charset, 'Content-Length': info.size });
  } catch (err) {
    send(res, 500, String(err && err.message));
  }
});

// Try a few ports rather than dying on "address in use" — a stale server from
// an earlier session is the most likely reason this script is run twice.
let port = FIRST_PORT;
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && port < FIRST_PORT + PORT_ATTEMPTS) {
    server.listen(++port, '127.0.0.1');
    return;
  }
  console.error(`\n  Could not start the server: ${err.message}\n`);
  process.exit(1);
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://localhost:${port}/`;
  console.log(`\n  Kotoba Lab`);
  console.log(`  serving  ${ROOT}`);
  console.log(`  open     ${url}`);
  if (port !== FIRST_PORT) console.log(`           (${FIRST_PORT} was busy)`);
  console.log(`\n  Ctrl+C to stop.\n`);
  if (OPEN) openBrowser(url);
});

function openBrowser(url) {
  const [cmd, cmdArgs] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  spawn(cmd, cmdArgs, { stdio: 'ignore', detached: true }).on('error', () => {
    console.log(`  (couldn't open a browser automatically — visit ${url})`);
  }).unref();
}
