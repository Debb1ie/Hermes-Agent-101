import { requireSession, rateLimit, incr, today } from './_store.js';
import { STUDENT_AGENTS, configured, hermesStream, friendly, httpStatus, UPSTREAM_TIMEOUT_MS } from './_hermes.js';

const MAX_MESSAGES = 12, MAX_CHARS = 2000;

// Real Hermes agents (Atlas, Forge, Iris). Streams the answer back to the browser as server-sent
// events, one JSON object per event: { type: 'status' | 'tool' | 'token' | 'error' | 'done', ... }.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const allowed = process.env.ALLOWED_ORIGIN?.replace(/\/+$/, '');
  if (allowed && req.headers.origin && req.headers.origin !== allowed) return res.status(403).json({ error: 'forbidden' });
  let user;
  try {
    user = await requireSession(req, res, ['student']);
  } catch (e) {
    console.error('agents-chat session lookup failed:', e);
    return res.status(503).json({ error: 'storage_unavailable', message: 'Storage is not configured.' });
  }
  if (!user) return;

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const agent = STUDENT_AGENTS.includes(body.agent) ? body.agent : null;
  if (!agent) return res.status(400).json({ error: 'bad_request', message: 'Pick Atlas, Forge, or Iris.' });
  // Only the conversation itself: a page can't add its own system message to steer the agent.
  const messages = (Array.isArray(body.messages) ? body.messages : [])
    .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_MESSAGES)
    .map(m => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  if (messages[messages.length - 1]?.role !== 'user') return res.status(400).json({ error: 'bad_request', message: 'Type a message first.' });
  if (!(await rateLimit(`agents:${user.id}`, 15, 600).catch(() => true))) {
    return res.status(429).json({ error: 'rate_limited', message: 'You’ve sent 15 messages in 10 minutes. Take a short break, then try again.' });
  }
  if (!configured(agent)) return res.status(httpStatus('not_configured')).json({ error: 'not_configured', message: friendly('not_configured') });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  const send = event => { if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`); };

  // Closing the page or pressing Stop drops the connection: cancel the Hermes run too.
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  // A comment line every 15 s keeps proxies from closing a quiet connection while the agent works.
  const ping = setInterval(() => { if (!res.writableEnded) res.write(': ping\n\n'); }, 15000);

  incr(`usage:${today()}:agents:${agent}`).catch(() => {});
  send({ type: 'status', text: 'Connecting…' });
  try {
    const result = await hermesStream(agent, messages, { signal: controller.signal, timeoutMs: UPSTREAM_TIMEOUT_MS, onEvent: send });
    if (result.error === 'aborted') return;
    if (result.error) send({ type: 'error', error: result.error, message: friendly(result.error) });
    else send({ type: 'done' });
  } finally {
    clearInterval(ping);
    if (!res.writableEnded) res.end();
  }
}
