import { requireSession } from './_store.js';
import { loadClass } from './_class.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const user = await requireSession(req, res, ['admin', 'mentor']);
    if (!user) return;
    return res.status(200).json(await loadClass(user));
  } catch (e) {
    console.error('dashboard data failed:', e);
    return res.status(503).json({ error: 'Storage is not configured or unreachable.' });
  }
}
