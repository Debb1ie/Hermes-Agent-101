// Run the whole site on this computer without the Vercel CLI: the page, the vercel.json rewrites
// and headers, and the api/*.js functions (with Vercel's req.body / req.query / res.status().json()).
// Reads ../.env. Without Supabase, accounts are kept in memory until you stop it.
//
//   node scripts/local-preview.mjs                 # http://localhost:3000
//   node scripts/local-preview.mjs 3001 admin      # port 3001, signed in as "Preview Admin"
//   node scripts/local-preview.mjs 3000 student    # signed in as "Preview Student" (no login screen)
//
// For the real deployment use Vercel. This is only for previewing and testing.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2] || process.env.PORT || 3000);
const AUTO = process.argv[3];

// .env: KEY=value lines; quotes are optional; values may contain spaces.
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && m[2] !== '' && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
if (AUTO === 'student' || AUTO === 'admin') process.env.DEV_AUTO_LOGIN = AUTO;
process.env.VERCEL_ENV = 'development';

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
const rewrites = cfg.rewrites.map(r => [new RegExp('^' + r.source + '$'), r.destination.replace(/^\//, '')]);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function headersFor(res, pathname) {
  for (const h of cfg.headers) {
    if (new RegExp('^' + h.source + '$').test(pathname)) for (const { key, value } of h.headers) res.setHeader(key, value);
  }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  headersFor(res, pathname);
  const fn = /^\/api\/([a-z-]+)$/.exec(pathname);
  if (fn) {
    const file = path.join(ROOT, 'api', fn[1] + '.js');
    if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
    const chunks = []; for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString();
    try { req.body = raw && /json/.test(req.headers['content-type'] || '') ? JSON.parse(raw) : raw || undefined; }
    catch { res.statusCode = 400; return res.end('Bad JSON'); }
    req.query = Object.fromEntries(url.searchParams);
    res.status = code => { res.statusCode = code; return res; };
    res.json = body => { if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); return res; };
    res.send = body => { res.end(typeof body === 'string' ? body : JSON.stringify(body)); return res; };
    try { await (await import(pathToFileURL(file).href)).default(req, res); }
    catch (e) { console.error(`api/${fn[1]} crashed:`, e); if (!res.headersSent) { res.statusCode = 500; res.end('Server error'); } }
    return;
  }
  const rel = pathname === '/' ? 'index.html' : rewrites.find(([rx]) => rx.test(pathname))?.[1] || pathname.slice(1);
  const full = path.join(ROOT, rel);
  // Only the website's own files: never the API source, scripts, or settings.
  if (!full.startsWith(ROOT + path.sep) || /^(api|scripts|hermes-side|\.)/.test(rel) || !fs.existsSync(full) || fs.statSync(full).isDirectory()) {
    res.statusCode = 404; return res.end('Not found');
  }
  res.setHeader('Content-Type', TYPES[path.extname(full)] || 'application/octet-stream');
  fs.createReadStream(full).pipe(res);
}).listen(PORT, () => console.log(`Hermes Agent 101 preview: http://localhost:${PORT}${process.env.DEV_AUTO_LOGIN ? ` (signed in as ${process.env.DEV_AUTO_LOGIN})` : ''}${process.env.HERMES_URL ? '' : '  [HERMES_URL not set: practice only]'}`));
