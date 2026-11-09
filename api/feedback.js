import { set, random, requireSession } from './_store.js';

const str = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
const num = (v, lo, hi) => { const x = Number(v); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, Math.round(x))) : null; };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const user = await requireSession(req, res, ['student']);
    if (!user) return;
    const b = req.body || {};
    const row = {
      id: random(12), studentId: user.id, name: user.name, email: user.email, certName: str(b.name, 100),
      program: str(b.program, 20), room: user.lab || str(b.room, 10), rating: num(b.rating, 1, 5),
      confBefore: num(b.confBefore, 1, 5), confAfter: num(b.confAfter, 1, 5),
      useful: str(b.useful, 40), pace: str(b.pace, 20), hackathon: str(b.hackathon, 20),
      tryHome: str(b.tryHome, 600), improve: str(b.improve, 800), mission: str(b.mission, 30),
      agent: str(b.agent, 80), testsScored: num(b.testsScored, 0, 100), team: str(b.team, 80),
      certId: str(b.certId, 20), submittedAt: str(b.submittedAt, 40) || new Date().toISOString()
    };
    if (row.name.length < 3 || !row.rating) return res.status(400).json({ error: 'bad_request' });
    await set(`feedback:${row.id}`, row);
    return res.status(201).json({ ok: true });
  } catch (e) {
    console.error('feedback save failed:', e);
    return res.status(503).json({ error: 'Storage is not configured.' });
  }
}
