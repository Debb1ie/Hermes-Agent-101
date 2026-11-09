import { get, set, requireSession } from './_store.js';

const text = (v, n) => typeof v === 'string' ? v.trim().slice(0, n) : '';
// What the student built in the course: their profile name, agent name, toolsets, and safety score.
function build(b) {
  if (!b || typeof b !== 'object') return null;
  return {
    profile: text(b.profile, 32), agent: text(b.agent, 60),
    tools: Array.isArray(b.tools) ? b.tools.slice(0, 20).map(t => String(t).slice(0, 30)) : [],
    safety: Number.isFinite(Number(b.safety)) ? Math.max(0, Math.min(20, Math.round(Number(b.safety)))) : 0
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  try {
    const user = await requireSession(req, res, ['student']);
    if (!user) return;
    const b = req.body || {};
    const key = `progress:${user.id}`, previous = await get(key);
    // After a facilitator reset, a page that hasn't cleared its old work yet must not save it back.
    if (previous?.resetAt && b.resetSeen !== previous.resetAt) return res.status(200).json({ reset: previous.resetAt });
    await set(key, {
      lab: ['CL6', 'CL7'].includes(b.lab) ? b.lab : user.lab,
      step: typeof b.step === 'string' ? b.step.slice(0, 40) : 'Start',
      mission: typeof b.mission === 'string' ? b.mission.slice(0, 40) : '',
      missionName: typeof b.missionName === 'string' ? b.missionName.slice(0, 80) : '',
      completed: Array.isArray(b.completed) ? b.completed.slice(0, 20).map(String) : [],
      build: build(b.build),
      updatedAt: new Date().toISOString(),
      ...(previous?.resetAt ? { resetAt: previous.resetAt } : {})
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('progress save failed:', e);
    return res.status(503).json({ error: 'Storage is not configured.' });
  }
}
