// Hermes edge: the one public door from the internet to this computer's Hermes, for the
// Hermes Agent 101 website. Run it next to Hermes and point a tunnel at it (see start.sh).
//
// It only allows:
//   GET  /health                                   → Hermes's own health check (no key needed)
//   GET  /h101/automations                         → latest output of Iris's scheduled jobs
//                                                    (Bearer = h101-assistant's API_SERVER_KEY)
//   POST /p/<h101 profile>/v1/chat/completions     → passed to Hermes as-is, streaming included
// Everything else (other profiles, other Hermes routes) gets 404, so it never leaves this computer.
// No npm dependencies. Node 18+.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const PORT = Number(process.env.EDGE_PORT || 8650);
const HERMES = (process.env.HERMES_LOCAL_URL || 'http://127.0.0.1:8642').replace(/\/+$/, '');
const HERMES_HOME = process.env.HERMES_HOME || path.join(os.homedir(), '.hermes');
const PROFILES = new Set(['h101-lab', 'h101-mentor', 'h101-researcher', 'h101-coder', 'h101-assistant']);
const CHAT = /^\/p\/([a-z0-9-]+)\/v1\/chat\/completions$/;
const MAX_BODY = 512 * 1024;

// Read on every request, so a rotated key works without restarting the edge.
function profileKey(profile) {
  try {
    const env = fs.readFileSync(path.join(HERMES_HOME, 'profiles', profile, '.env'), 'utf8');
    return (/^API_SERVER_KEY=(.*)$/m.exec(env)?.[1] || '').trim().replace(/^["']|["']$/g, '');
  } catch { return ''; }
}
const sameSecret = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};
const send = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); };

// Iris's cron jobs, mapped to the ids the website expects.
const SLUGS = [[/morning/i, 'morning-briefing'], [/midday|noon|lunch/i, 'midday-tip'], [/evening|wrap/i, 'evening-wrap-up']];
function automations() {
  const cron = path.join(HERMES_HOME, 'profiles', 'h101-assistant', 'cron');
  let jobs = [];
  try { jobs = JSON.parse(fs.readFileSync(path.join(cron, 'jobs.json'), 'utf8')).jobs || []; } catch {}
  return jobs.map(job => {
    let markdown = '', ranAt = job.last_run_at || null;
    try {
      const dir = path.join(cron, 'output', job.id);
      const latest = fs.readdirSync(dir).filter(f => f.endsWith('.md')).sort().pop();
      if (latest) {
        const text = fs.readFileSync(path.join(dir, latest), 'utf8');
        const cut = text.search(/^## Response\s*$/m);
        markdown = (cut >= 0 ? text.slice(cut).replace(/^## Response\s*/, '') : text).trim();
        if (markdown === '[SILENT]') markdown = '';
        const run = /\*\*Run Time:\*\*\s*(\d{4}-\d\d-\d\d)[ T](\d\d:\d\d:\d\d)/.exec(text);
        if (run) ranAt = new Date(`${run[1]}T${run[2]}`).toISOString();
      }
    } catch {}
    const slug = SLUGS.find(([rx]) => rx.test(job.name || ''))?.[1] || job.id;
    return { id: slug, name: job.name || slug, schedule: job.schedule?.display || job.schedule?.expr || job.schedule_display || '', ranAt, markdown: markdown.slice(0, 20000) };
  });
}

function proxy(req, res, pathname, body) {
  const started = Date.now();
  const headers = { Accept: req.headers.accept || 'application/json' };
  if (req.headers.authorization) headers.Authorization = req.headers.authorization;
  if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = body.length; }
  const up = http.request(HERMES + pathname, { method: req.method, headers }, upRes => {
    const out = { 'Cache-Control': 'no-store' };
    for (const h of ['content-type', 'x-accel-buffering']) if (upRes.headers[h]) out[h] = upRes.headers[h];
    res.writeHead(upRes.statusCode || 502, out);
    upRes.pipe(res);
    upRes.on('end', () => console.log(`${new Date().toISOString()} ${req.method} ${pathname} ${upRes.statusCode} ${Date.now() - started}ms`));
  });
  up.setTimeout(250000, () => up.destroy(new Error('timeout')));
  up.on('error', e => { console.error(`${req.method} ${pathname} upstream error: ${e.message}`); if (!res.headersSent) send(res, 502, { error: 'hermes_unreachable' }); else res.end(); });
  // The website disconnected (student left or pressed Stop): stop the Hermes run too.
  res.on('close', () => { if (!res.writableFinished) up.destroy(); });
  up.end(body);
}

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://edge');
  try {
    if (req.method === 'GET' && pathname === '/health') return proxy(req, res, '/health');
    if (req.method === 'GET' && pathname === '/h101/automations') {
      const key = profileKey('h101-assistant'), auth = String(req.headers.authorization || '');
      if (!key || !auth.startsWith('Bearer ') || !sameSecret(auth.slice(7), key)) return send(res, 401, { error: 'unauthorized' });
      return send(res, 200, { automations: automations() });
    }
    const chat = CHAT.exec(pathname);
    if (req.method === 'POST' && chat && PROFILES.has(chat[1])) {
      const chunks = []; let size = 0;
      for await (const c of req) { size += c.length; if (size > MAX_BODY) return send(res, 413, { error: 'too_large' }); chunks.push(c); }
      return proxy(req, res, pathname, Buffer.concat(chunks));
    }
    send(res, 404, { error: 'not_found' });
  } catch (e) {
    console.error('edge error:', e.message);
    if (!res.headersSent) send(res, 500, { error: 'edge_error' });
  }
}).listen(PORT, '127.0.0.1', () => console.log(`Hermes edge on http://127.0.0.1:${PORT} → ${HERMES}`));
