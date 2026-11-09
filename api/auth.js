import { get, set, del, random, passwordHash, passwordMatches, session, secureCookie, createSession, cookie, publicUser, rateLimit, clientIp, sealPassword, STORAGE_MISSING } from './_store.js';

const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const email = v => clean(v, 160).toLowerCase();
const validPassword = p => typeof p === 'string' && p.length >= 12;
const LABS = ['CL6', 'CL7'];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  try {
    if (req.method === 'GET') {
      const user = await session(req);
      return res.status(200).json({ user: user ? publicUser(user) : null });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const action = body.action;
    if (action === 'logout') {
      const id = cookie(req);
      if (id) await del(`session:${id}`);
      secureCookie(res, '', 0);
      return res.status(200).json({ ok: true });
    }
    if (action === 'signup') {
      const name = clean(body.name, 100), mail = email(body.email), password = body.password;
      if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || !validPassword(password)) return res.status(400).json({ error: 'Use a valid name, email, and password of at least 12 characters.' });
      if (!LABS.includes(body.lab)) return res.status(400).json({ error: 'Choose Lab 6 or Lab 7.' });
      if (process.env.ADMIN_EMAIL && mail === email(process.env.ADMIN_EMAIL)) return res.status(409).json({ error: 'An account with that email already exists.' });
      if (await get(`user:email:${mail}`)) return res.status(409).json({ error: 'An account with that email already exists.' });
      const user = { id: random(12), name, email: mail, role: 'student', password: await passwordHash(password), passwordSealed: sealPassword(password), lab: body.lab, createdAt: new Date().toISOString() };
      await set(`user:email:${mail}`, user);
      await set(`user:${user.id}`, user);
      await createSession(res, user);
      return res.status(201).json({ user: publicUser(user) });
    }
    if (action === 'login') {
      const mail = email(body.email), password = body.password;
      if (!mail || typeof password !== 'string' || !password) return res.status(400).json({ error: 'Enter your email and password.' });
      if (!(await rateLimit(`login:${clientIp(req)}:${mail}`, 10, 600))) return res.status(429).json({ error: 'Too many sign-in attempts. Wait 10 minutes and try again.' });
      const fail = async () => { await new Promise(resolve => setTimeout(resolve, 700)); return res.status(401).json({ error: 'Incorrect email or password.' }); };
      let user;
      if (process.env.ADMIN_EMAIL && mail === email(process.env.ADMIN_EMAIL)) {
        // The admin is always checked against the environment, so rotating ADMIN_PASSWORD
        // immediately invalidates the old password.
        if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) return fail();
        user = { id: 'admin', name: process.env.ADMIN_NAME || 'Super Admin', email: mail, role: 'admin', lab: null };
      } else {
        user = await get(`user:email:${mail}`);
        if (!user || !(await passwordMatches(password, user.password))) return fail();
      }
      await createSession(res, user);
      return res.status(200).json({ user: publicUser(user) });
    }
    if (action === 'forgot') {
      // Same answer whether or not the email exists, so this can't be used to discover accounts.
      const mail = email(body.email);
      const user = mail ? await get(`user:email:${mail}`) : null;
      if (user && ['student', 'mentor'].includes(user.role)) {
        await set(`reset-request:${user.id}`, { id: user.id, name: user.name, email: user.email, role: user.role, lab: user.lab ?? null, at: new Date().toISOString() });
      }
      return res.status(200).json({ ok: true });
    }
    if (action === 'change-password') {
      const current = await session(req);
      if (!current) return res.status(401).json({ error: 'Please sign in again.' });
      const user = await get(`user:${current.id}`);
      if (!user?.password) return res.status(400).json({ error: 'This account’s password is managed outside the app.' });
      if (!(await rateLimit(`change:${user.id}`, 10, 600))) return res.status(429).json({ error: 'Too many attempts. Wait 10 minutes and try again.' });
      if (!(await passwordMatches(body.current, user.password))) return res.status(401).json({ error: 'Your current (temporary) password is incorrect.' });
      if (!validPassword(body.next)) return res.status(400).json({ error: 'Use at least 12 characters for your new password.' });
      if (body.next === body.current) return res.status(400).json({ error: 'Choose a password different from the temporary one.' });
      const updated = { ...user, password: await passwordHash(body.next), passwordSealed: sealPassword(body.next), mustChangePassword: false, passwordChangedAt: new Date().toISOString() };
      await set(`user:${user.id}`, updated); await set(`user:email:${user.email}`, updated);
      await set(`session:${cookie(req)}`, { ...current, mustChangePassword: false });
      await del(`reset-request:${user.id}`);
      return res.status(200).json({ user: publicUser(updated) });
    }
    if (action === 'create-mentor') {
      const current = await session(req);
      if (!current || current.role !== 'admin') return res.status(401).json({ error: 'Only the super admin can create mentor accounts.' });
      const name = clean(body.name, 100), mail = email(body.email), password = body.password;
      if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || !validPassword(password) || !LABS.includes(body.lab)) return res.status(400).json({ error: 'Provide name, email, lab, and a 12-character password.' });
      if ((process.env.ADMIN_EMAIL && mail === email(process.env.ADMIN_EMAIL)) || await get(`user:email:${mail}`)) return res.status(409).json({ error: 'That email is already registered.' });
      const user = { id: random(12), name, email: mail, role: 'mentor', lab: body.lab, password: await passwordHash(password), passwordSealed: sealPassword(password), createdAt: new Date().toISOString() };
      await set(`user:email:${mail}`, user); await set(`user:${user.id}`, user);
      return res.status(201).json({ ok: true });
    }
    return res.status(400).json({ error: 'Unknown action.' });
  } catch (e) {
    console.error('auth failed:', e);
    return res.status(503).json({ error: e.message === STORAGE_MISSING ? 'Storage is not configured.' : 'Authentication failed.' });
  }
}
