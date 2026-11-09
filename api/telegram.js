import { get, set, requireSession, rateLimit, STORAGE_MISSING } from './_store.js';
import { botUsername, telegramKey } from './_hermes.js';

// Hermes pairing codes: 8 characters from an alphabet without 0/O or 1/I.
const CODE = /^[A-HJ-NP-Z2-9]{8}$/;
const USERNAME = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

// A student saves the pairing code the bot sent them. A mentor approves it on the dashboard;
// the Hermes operator then runs the approve command on the Hermes host.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const user = await requireSession(req, res, ['student']);
    if (!user) return;
    const bot = botUsername();
    const view = pairing => ({ bot, link: bot ? `https://t.me/${bot}` : null, pairing: pairing || null });
    const key = telegramKey(user.id);
    if (req.method === 'GET') return res.status(200).json(view(await get(key)));
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    if (!(await rateLimit(`telegram:${user.id}`, 10, 600))) return res.status(429).json({ error: 'Too many tries. Wait 10 minutes and try again.' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const code = String(body.code || '').toUpperCase().replace(/[\s-]/g, '');
    const username = String(body.username || '').trim().replace(/^@/, '');
    if (!CODE.test(code)) return res.status(400).json({ error: 'That doesn’t look like a pairing code. It has 8 letters and numbers, like K7MPX3QA.' });
    if (username && !USERNAME.test(username)) return res.status(400).json({ error: 'Check your Telegram username: 5 to 32 letters, numbers, or _. You can leave it empty.' });
    const previous = await get(key);
    if (previous?.code === code && previous.status === 'approved') return res.status(200).json(view(previous));
    const pairing = { code, username: username ? '@' + username : '', status: 'pending', at: new Date().toISOString() };
    await set(key, pairing);
    return res.status(200).json(view(pairing));
  } catch (e) {
    console.error('telegram pairing failed:', e);
    return res.status(503).json({ error: e.message === STORAGE_MISSING ? 'Storage is not configured.' : 'Couldn’t save your code. Try again.' });
  }
}
