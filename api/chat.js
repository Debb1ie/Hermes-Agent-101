import { requireSession, rateLimit, incr, today } from './_store.js';
import { configured, hermesChat, friendly, httpStatus, AGENTS, UPSTREAM_TIMEOUT_MS } from './_hermes.js';

// Playground Live AI. The student's agent prompt arrives as a `system` message, which Hermes layers
// on top of the h101-lab profile's own instructions. That profile has no tools: the THOUGHT / ACTION /
// OBSERVATION loop and the simulated tools run in the browser, exactly like the practice agent.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  const allowed = process.env.ALLOWED_ORIGIN?.replace(/\/+$/, '');
  if (allowed && req.headers.origin && req.headers.origin !== allowed) return res.status(403).json({ error: 'forbidden' });
  let user;
  try {
    user = await requireSession(req, res, ['student']);
  } catch (e) {
    console.error('chat session lookup failed:', e);
    return res.status(503).json({ error: 'storage_unavailable' });
  }
  if (!user) return;
  // One agent run is about 3-5 requests, so 20 a minute is plenty for real use.
  if (!(await rateLimit(`chat:${user.id}`, 20, 60).catch(() => true))) return res.status(429).json({ error: 'rate_limited', message: 'You’re sending very fast. Wait a minute.' });
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (!messages.length || messages.length > 30) return res.status(400).json({ error: 'bad_request' });
  const clean = messages
    .filter(m => m && ['system', 'user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .map(m => ({ role: m.role, content: m.content.slice(0, 8000) }));
  if (!clean.length) return res.status(400).json({ error: 'bad_request' });
  if (!configured('lab')) return res.status(503).json({ error: 'not_configured', message: friendly('not_configured') });

  // If the student leaves or reloads, stop waiting for Hermes.
  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  incr(`usage:${today()}:live:${user.lab || 'none'}`).catch(() => {});
  const result = await hermesChat('lab', clean, { signal: controller.signal, timeoutMs: UPSTREAM_TIMEOUT_MS });
  if (controller.signal.aborted) return;
  if (result.text) return res.status(200).json({ text: result.text, model: AGENTS.lab.profile });
  return res.status(httpStatus(result.error)).json({ error: result.error === 'busy' ? 'rate_limited' : result.error, message: friendly(result.error) });
}
