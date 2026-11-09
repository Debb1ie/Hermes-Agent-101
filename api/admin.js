import crypto from 'node:crypto';
import { get, set, del, list, cookie, requireSession, passwordHash, passwordMatches, publicUser, rateLimit, sealPassword, openPassword, canViewPasswords, today, WORKSHOP_TZ, STORAGE_MISSING } from './_store.js';
import { AGENTS, STUDENT_AGENTS, baseUrl, configured, hermesHealth, pairingCommand, botUsername, telegramKey } from './_hermes.js';

const UNLOCK_MS = 10 * 60 * 1000;
const LABS = ['CL6', 'CL7'];

const sameSecret = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest(), y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

// Readable temporary password, e.g. "k7mp-x3qa-9rtw" (no 0/o/1/l to avoid misreading).
function tempPassword() {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  const chars = [...crypto.randomBytes(12)].map(b => alphabet[b % alphabet.length]).join('');
  return chars.match(/.{4}/g).join('-');
}

// Everything the Hermes tab shows. Never includes keys: only whether each one is set.
async function hermesStatus() {
  const date = today();
  const [health, pairingRows, userRows, usageRows] = await Promise.all([hermesHealth(), list('telegram:'), list('user:'), list(`usage:${date}:`)]);
  const users = new Map(userRows.filter(row => !row.key.startsWith('user:email:')).map(row => [row.value?.id, row.value]));
  const telegram = pairingRows.map(row => {
    const id = row.key.slice('telegram:'.length), u = users.get(id), p = row.value || {};
    return { id, name: u?.name || 'Unknown student', email: u?.email || '', lab: u?.lab || null, code: p.code, username: p.username || '', status: p.status, at: p.at, approvedAt: p.approvedAt || null, approvedBy: p.approvedBy || null, command: pairingCommand(p.code) };
  }).filter(r => r.code).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || String(b.at).localeCompare(String(a.at)));
  const count = suffix => Number(usageRows.find(row => row.key === `usage:${date}:${suffix}`)?.value) || 0;
  const live = { CL6: count('live:CL6'), CL7: count('live:CL7') };
  const agents = Object.fromEntries(STUDENT_AGENTS.map(a => [a, count(`agents:${a}`)]));
  let host = null;
  try { host = baseUrl() ? new URL(baseUrl()).host : null; } catch {}
  return {
    hermes: { online: health.ok, ms: health.ms, configured: Boolean(baseUrl()), host, checkedAt: new Date().toISOString(),
      profiles: Object.entries(AGENTS).map(([use, a]) => ({ use, profile: a.profile, env: a.env, label: a.label, keySet: configured(use) })) },
    telegram, bot: botUsername(),
    usage: { date, timeZone: WORKSHOP_TZ, live, agents, agentsTotal: Object.values(agents).reduce((x, y) => x + y, 0) }
  };
}

// Mentors may act only on students in their own lab; the admin may act on students and mentors.
const canManage = (viewer, user) => Boolean(user) && (viewer.role === 'admin'
  ? ['student', 'mentor'].includes(user.role)
  : user.role === 'student' && user.lab === viewer.lab);

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    const viewer = await requireSession(req, res, ['admin', 'mentor']);
    if (!viewer) return;
    const isAdmin = viewer.role === 'admin';
    const unlocked = () => Number(viewer.unlockedUntil) > Date.now();
    const unlockedUntil = unlocked() ? viewer.unlockedUntil : null;
    // ?hermes=1 adds the Hermes tab's data (admin only); it pings Hermes, so it's only asked for on that tab.
    if (req.method === 'GET') return res.status(200).json(isAdmin && req.query?.hermes ? { ...(await hermesStatus()), unlockedUntil } : { unlockedUntil });
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const adminOnly = ['account', 'set-mentor-lab', 'approve-telegram'];
    if (adminOnly.includes(body.action) && !isAdmin) return res.status(401).json({ error: 'unauthorized' });

    // Marks a student's Telegram pairing code as approved and returns the command the Hermes operator
    // runs on the Hermes host. This website never runs shell commands itself.
    if (body.action === 'approve-telegram') {
      const id = typeof body.id === 'string' ? body.id : '';
      const key = telegramKey(id), pairing = id ? await get(key) : null;
      if (!pairing?.code) return res.status(404).json({ error: 'Pairing request not found.' });
      const updated = pairing.status === 'approved' ? pairing : { ...pairing, status: 'approved', approvedAt: new Date().toISOString(), approvedBy: viewer.name };
      await set(key, updated);
      console.log(`telegram pairing ${pairing.code} approved by ${viewer.email}`);
      return res.status(200).json({ id, pairing: updated, command: pairingCommand(updated.code) });
    }

    if (body.action === 'unlock') {
      if (!(await rateLimit(`unlock:${viewer.id}`, 5, 600))) return res.status(429).json({ error: 'Too many attempts. Wait 10 minutes and try again.' });
      // Staff confirm with their own password. Same source of truth as login: the environment
      // admin if configured, otherwise the account stored in Supabase.
      const envAdmin = isAdmin && process.env.ADMIN_EMAIL && viewer.email === process.env.ADMIN_EMAIL.trim().toLowerCase();
      const stored = envAdmin ? null : await get(`user:email:${viewer.email}`);
      const ok = typeof body.password === 'string' && (envAdmin
        ? Boolean(process.env.ADMIN_PASSWORD) && sameSecret(body.password, process.env.ADMIN_PASSWORD)
        : stored?.role === viewer.role && await passwordMatches(body.password, stored.password));
      if (!ok) {
        await new Promise(resolve => setTimeout(resolve, 800));
        return res.status(401).json({ error: 'Incorrect password.' });
      }
      const until = Date.now() + UNLOCK_MS;
      await set(`session:${cookie(req)}`, { ...viewer, unlockedUntil: until });
      return res.status(200).json({ unlockedUntil: until });
    }

    if (body.action === 'lock') {
      await set(`session:${cookie(req)}`, { ...viewer, unlockedUntil: 0 });
      return res.status(200).json({ unlockedUntil: null });
    }

    const id = typeof body.id === 'string' && body.id !== 'admin' ? body.id : '';
    const user = id ? await get(`user:${id}`) : null;

    if (body.action === 'set-mentor-lab') {
      if (user?.role !== 'mentor') return res.status(404).json({ error: 'Mentor not found.' });
      if (!LABS.includes(body.lab)) return res.status(400).json({ error: 'Choose Lab 6 or Lab 7.' });
      const updated = { ...user, lab: body.lab };
      await set(`user:${user.id}`, updated); await set(`user:email:${user.email}`, updated);
      // Mentors' sessions carry their lab, so update any they're signed in with: the change applies on their next refresh.
      const now = Date.now();
      for (const row of await list('session:')) {
        if (row.value?.id !== user.id || !(row.value.expiresAt > now)) continue;
        await set(row.key, { ...row.value, lab: body.lab }, Math.ceil((row.value.expiresAt - now) / 1000));
      }
      console.log(`mentor lab changed: ${user.email} to ${body.lab} by ${viewer.email}`);
      return res.status(200).json({ id: user.id, lab: body.lab });
    }

    if (body.action === 'dismiss-request') {
      if (!canManage(viewer, user)) return res.status(404).json({ error: 'Request not found.' });
      await del(`reset-request:${user.id}`);
      return res.status(200).json({ ok: true });
    }

    if (body.action === 'reveal-password') {
      if (!unlocked()) return res.status(403).json({ error: 'locked' });
      if (!canManage(viewer, user)) return res.status(404).json({ error: 'Account not found.' });
      if (!canViewPasswords) return res.status(400).json({ error: 'Password viewing is not set up. Add PASSWORD_VIEW_KEY in Vercel.' });
      if (!(await rateLimit(`reveal:${viewer.id}`, 40, 600))) return res.status(429).json({ error: 'Too many password views. Wait a few minutes.' });
      const password = openPassword(user.passwordSealed);
      if (!password) return res.status(404).json({ error: 'This password was set before viewing was turned on. Reset it to give them a new one.' });
      const viewed = { by: viewer.name, role: viewer.role, at: new Date().toISOString() };
      const updated = { ...user, passwordLastViewed: viewed };
      await set(`user:${user.id}`, updated); await set(`user:email:${user.email}`, updated);
      console.log(`password viewed: ${user.email} by ${viewer.email} (${viewer.role})`);
      return res.status(200).json({ email: user.email, password, viewed });
    }

    if (['account', 'reset-password', 'reset-progress'].includes(body.action)) {
      if (!unlocked()) return res.status(403).json({ error: 'locked' });
      if (!canManage(viewer, user)) return res.status(404).json({ error: 'Account not found.' });

      if (body.action === 'reset-password') {
        const password = tempPassword();
        const updated = { ...user, password: await passwordHash(password), passwordSealed: sealPassword(password), passwordResetAt: new Date().toISOString(), mustChangePassword: Boolean(body.force) };
        await set(`user:${user.id}`, updated);
        await set(`user:email:${user.email}`, updated);
        await del(`reset-request:${user.id}`);
        return res.status(200).json({ email: user.email, password, mustChangePassword: updated.mustChangePassword });
      }

      if (body.action === 'reset-progress') {
        if (user.role !== 'student') return res.status(400).json({ error: 'Only student progress can be reset.' });
        const previous = await get(`progress:${user.id}`) || {};
        const at = new Date().toISOString();
        // History first, so a failed reset never loses what the student had.
        await set(`progress-reset:${user.id}:${at}`, { studentId: user.id, name: user.name, email: user.email, lab: user.lab, by: viewer.name, byRole: viewer.role, at, previous });
        // resetAt tells the student's page to clear the work it keeps in browser storage (see progress.js).
        await set(`progress:${user.id}`, { lab: previous.lab || user.lab, step: '', mission: '', missionName: '', completed: [], updatedAt: at, resetAt: at });
        console.log(`progress reset: ${user.email} by ${viewer.email}`);
        return res.status(200).json({ ok: true, at });
      }

      const [progress, feedbackRows, resetRows, pairing] = await Promise.all([get(`progress:${user.id}`), list('feedback:'), list(`progress-reset:${user.id}:`), get(telegramKey(user.id))]);
      const feedback = feedbackRows.map(row => row.value).filter(row => row?.studentId === user.id)
        .sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)));
      return res.status(200).json({
        account: { ...publicUser(user), createdAt: user.createdAt || null, passwordResetAt: user.passwordResetAt || null, passwordViewable: canViewPasswords && Boolean(user.passwordSealed), passwordLastViewed: user.passwordLastViewed || null },
        progress: progress || {},
        feedback,
        resets: resetRows.map(row => row.value).filter(Boolean).sort((a, b) => String(b.at).localeCompare(String(a.at))),
        telegram: user.role === 'student' && pairing?.code ? { ...pairing, command: pairingCommand(pairing.code) } : null
      });
    }

    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    console.error('admin action failed:', e);
    return res.status(503).json({ error: e.message === STORAGE_MISSING ? 'Storage is not configured.' : 'Admin action failed.' });
  }
}
