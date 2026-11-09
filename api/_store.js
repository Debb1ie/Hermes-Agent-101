import crypto from 'node:crypto';

const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const supabaseUrl = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
const supabaseKey = (process.env.SUPABASE_SERVICE_KEY || '').trim();
const useSupabase = Boolean(supabaseUrl && supabaseKey);
const useKv = !useSupabase && Boolean(kvUrl && kvToken);
// In-memory storage is per serverless instance, so accounts would randomly disappear on Vercel.
// Only allow it for local development.
const allowMemory = !process.env.VERCEL || process.env.VERCEL_ENV === 'development';
const memory = globalThis.__hermes101Memory || (globalThis.__hermes101Memory = new Map());

export const storageConfigured = useSupabase || useKv;
export const STORAGE_MISSING = 'Storage is not configured';

function requireStorage() {
  if (!storageConfigured && !allowMemory) throw new Error(STORAGE_MISSING);
}

async function supabase(path, init = {}) {
  // Legacy service_role keys are JWTs and go in both headers. New sb_secret_ keys are not JWTs
  // and must only be sent as the apikey header.
  const auth = supabaseKey.startsWith('eyJ') ? { Authorization: 'Bearer ' + supabaseKey } : {};
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: supabaseKey,
      ...auth,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    console.error(`Supabase ${init.method || 'GET'} ${path.split('?')[0]} failed: ${response.status} ${detail.slice(0, 300)}`);
    throw new Error('Supabase request failed');
  }
  return response;
}

async function redisCommand(...args) {
  const response = await fetch(`${kvUrl}/pipeline`, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + kvToken, 'Content-Type': 'application/json' },
    body: JSON.stringify([args])
  });
  if (!response.ok) throw new Error('Redis request failed');
  return (await response.json())?.[0]?.result;
}

export async function get(key) {
  requireStorage();
  if (useSupabase) {
    const rows = await (await supabase(`app_store?select=value&key=eq.${encodeURIComponent(key)}&limit=1`)).json();
    return rows[0]?.value ?? null;
  }
  if (useKv) {
    const value = await redisCommand('GET', key);
    return value ? JSON.parse(value) : null;
  }
  return memory.get(key) ?? null;
}

export async function set(key, value, ttl) {
  requireStorage();
  if (useSupabase) {
    await supabase('app_store?on_conflict=key', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify({ key, value })
    });
    return;
  }
  if (useKv) {
    const args = ['SET', key, JSON.stringify(value)];
    if (ttl) args.push('EX', String(ttl));
    await redisCommand(...args);
    return;
  }
  memory.set(key, value);
}

export async function del(key) {
  requireStorage();
  if (useSupabase) {
    await supabase(`app_store?key=eq.${encodeURIComponent(key)}`, { method: 'DELETE' });
    return;
  }
  if (useKv) await redisCommand('DEL', key);
  else memory.delete(key);
}

// Returns [{ key, value }] for every key starting with `prefix`, in one round trip where possible.
export async function list(prefix) {
  requireStorage();
  if (useSupabase) {
    const like = encodeURIComponent(prefix.replace(/[\\%_]/g, '\\$&') + '%');
    const rows = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await (await supabase(`app_store?select=key,value&key=like.${like}&order=key&limit=1000&offset=${offset}`)).json();
      rows.push(...page);
      if (page.length < 1000) return rows;
    }
  }
  if (useKv) {
    const found = (await redisCommand('KEYS', prefix + '*')) || [];
    if (!found.length) return [];
    const values = await redisCommand('MGET', ...found);
    return found.map((key, i) => ({ key, value: values?.[i] ? JSON.parse(values[i]) : null }));
  }
  return [...memory.entries()].filter(([key]) => key.startsWith(prefix)).map(([key, value]) => ({ key, value }));
}

// Adds `by` to a numeric counter and returns the new value. Supabase does it in one atomic
// statement (see app_store_increment in supabase.sql); if that function is missing it falls back
// to read-then-write, which can miss a count when two requests land at the same moment.
let rpcMissing = false;
export async function incr(key, by = 1) {
  requireStorage();
  if (useSupabase) {
    if (!rpcMissing) {
      try {
        const r = await supabase('rpc/app_store_increment', { method: 'POST', body: JSON.stringify({ p_key: key, p_by: by }) });
        return Number(await r.json()) || 0;
      } catch {
        rpcMissing = true;
        console.error('app_store_increment is missing: run supabase.sql again. Usage counts fall back to read-then-write.');
      }
    }
    const next = (Number(await get(key)) || 0) + by;
    await set(key, next);
    return next;
  }
  if (useKv) return Number(await redisCommand('INCRBY', key, String(by))) || 0;
  const next = (Number(memory.get(key)) || 0) + by;
  memory.set(key, next);
  return next;
}

// Today's date (YYYY-MM-DD) in the workshop's time zone, for daily usage counts.
export const WORKSHOP_TZ = (process.env.WORKSHOP_TZ || 'Asia/Manila').trim();
export function today(date = new Date()) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: WORKSHOP_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
  catch { return date.toISOString().slice(0, 10); }
}

export const random = bytes => crypto.randomBytes(bytes).toString('hex');

const secretKey = value => value ? crypto.createHash('sha256').update(value).digest() : null;

function seal(key, text) {
  if (!key) return null;
  const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(text), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}

function unseal(key, sealed) {
  if (!key || typeof sealed !== 'string') return null;
  try {
    const [iv, tag, data] = sealed.split('.').map(part => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// Viewable passwords: besides the one-way hash used to sign in, a copy is encrypted with
// PASSWORD_VIEW_KEY (server only) so a facilitator can read it back. Without the key, the feature is off.
const viewKey = secretKey(process.env.PASSWORD_VIEW_KEY);
export const canViewPasswords = Boolean(viewKey);
export const sealPassword = password => seal(viewKey, password);
export const openPassword = sealed => unseal(viewKey, sealed);

export async function passwordHash(password, salt = random(16)) {
  const derived = await new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password), salt, 120000, 32, 'sha256', (error, key) => {
      if (error) reject(error);
      else resolve(key.toString('hex'));
    });
  });
  return `${salt}:${derived}`;
}

export async function passwordMatches(password, stored) {
  const [salt, expected] = String(stored || '').split(':');
  if (!salt || !expected || typeof password !== 'string') return false;
  const actual = (await passwordHash(password, salt)).split(':')[1];
  return actual.length === expected.length && crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export const SESSION_SECONDS = 86400 * 7;

export function cookie(req) {
  return (req.headers.cookie || '').split(';').map(value => value.trim())
    .find(value => value.startsWith('hermes101_session='))?.split('=')[1] || '';
}

export const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, lab: user.lab ?? null, mustChangePassword: Boolean(user.mustChangePassword) });

export async function createSession(res, user) {
  const sid = random(32);
  await set(`session:${sid}`, { ...publicUser(user), expiresAt: Date.now() + SESSION_SECONDS * 1000 }, SESSION_SECONDS);
  secureCookie(res, sid);
}

export async function session(req) {
  const id = cookie(req);
  if (!id) return null;
  const user = await get(`session:${id}`);
  // Supabase has no TTL, so expiry is enforced here.
  if (user?.expiresAt && user.expiresAt < Date.now()) {
    await del(`session:${id}`).catch(() => {});
    return null;
  }
  return user;
}

export async function requireSession(req, res, roles = []) {
  const user = await session(req);
  if (!user || (roles.length && !roles.includes(user.role))) {
    res.status(401).json({ error: 'unauthorized' });
    return null;
  }
  // Enforced here, not just in the page, so the "choose a new password" screen can't be skipped.
  if (user.mustChangePassword) {
    res.status(403).json({ error: 'password_change_required' });
    return null;
  }
  return user;
}

// Fixed-window limit: allows `limit` calls per `windowSeconds` for `key`. Returns false when exceeded.
export async function rateLimit(key, limit, windowSeconds) {
  const now = Date.now(), k = `ratelimit:${key}`;
  const entry = await get(k);
  const fresh = !entry || now - entry.start > windowSeconds * 1000;
  const next = fresh ? { start: now, count: 1 } : { start: entry.start, count: entry.count + 1 };
  if (!fresh && entry.count >= limit) return false;
  await set(k, next, windowSeconds);
  return true;
}

export const clientIp = req => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';

export function secureCookie(res, value, maxAge = SESSION_SECONDS) {
  // Safari rejects Secure cookies on http://localhost, so drop the flag only under `vercel dev`.
  const secure = process.env.VERCEL_ENV === 'development' ? '' : ' Secure;';
  res.setHeader('Set-Cookie', `hermes101_session=${value}; Path=/; HttpOnly; SameSite=Lax;${secure} Max-Age=${maxAge}`);
}
