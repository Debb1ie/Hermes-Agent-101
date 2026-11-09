import { requireSession, STORAGE_MISSING } from './_store.js';
import { hermesGet, friendly } from './_hermes.js';

const CACHE_MS = 60000;
let cache = { at: 0, value: null };

const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : '';

// The latest output of Iris's scheduled jobs. Hermes serves them at GET ${HERMES_URL}/h101/automations
// (Bearer HERMES_KEY_ASSISTANT) as { automations: [{ id, name, schedule, ranAt, markdown }] }.
// Cached for 60 seconds so a full class opening the page asks Hermes about once a minute.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    if (!(await requireSession(req, res))) return;
  } catch (e) {
    return res.status(503).json({ error: e.message === STORAGE_MISSING ? 'Storage is not configured.' : 'Storage is unreachable.' });
  }
  if (cache.value && Date.now() - cache.at < CACHE_MS) return res.status(200).json(cache.value);
  const r = await hermesGet('assistant', '/h101/automations');
  if (r.error) return res.status(200).json({ automations: [], error: r.error, message: friendly(r.error) });
  const list = Array.isArray(r.data?.automations) ? r.data.automations : [];
  const value = {
    automations: list.slice(0, 12).map(a => ({
      id: str(a?.id, 80), name: str(a?.name, 120), schedule: str(a?.schedule, 80),
      ranAt: str(a?.ranAt, 40) || null, markdown: str(a?.markdown, 20000)
    })),
    fetchedAt: new Date().toISOString()
  };
  cache = { at: Date.now(), value };
  return res.status(200).json(value);
}
