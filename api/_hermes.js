// The only module that talks to Hermes. Every agent is a Hermes profile behind one base URL,
// reached through Hermes's OpenAI-compatible API:
//   POST ${HERMES_URL}/p/<profile>/v1/chat/completions   (Bearer <that profile's key>)
// Keys come from server environment variables and never reach a browser.

export const AGENTS = {
  lab: { profile: 'h101-lab', env: 'HERMES_KEY_LAB', label: 'Playground Live AI' },
  mentor: { profile: 'h101-mentor', env: 'HERMES_KEY_MENTOR', label: 'Dashboard assistant' },
  researcher: { profile: 'h101-researcher', env: 'HERMES_KEY_RESEARCHER', label: 'Atlas, researcher' },
  coder: { profile: 'h101-coder', env: 'HERMES_KEY_CODER', label: 'Forge, coder' },
  assistant: { profile: 'h101-assistant', env: 'HERMES_KEY_ASSISTANT', label: 'Iris, daily assistant' }
};
// The three agents students chat with on the Real Hermes agents page.
export const STUDENT_AGENTS = ['researcher', 'coder', 'assistant'];

// Free models can take 20-90 seconds per answer. Vercel allows 300 s for these functions (vercel.json).
export const UPSTREAM_TIMEOUT_MS = 240000;

// Pasted values often carry a stray space, line break, or quotes.
const clean = value => String(value || '').trim().replace(/^["']+|["']+$/g, '').trim();
export function baseUrl() {
  const url = clean(process.env.HERMES_URL).replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+/i.test(url) ? url : '';
}
const keyFor = use => clean(process.env[AGENTS[use]?.env]);
export const configured = use => Boolean(AGENTS[use] && baseUrl() && keyFor(use));

// What students and staff see for each failure. Never includes upstream details.
export const MESSAGES = {
  not_configured: 'Hermes isn’t connected yet. Ask your mentor.',
  invalid_key: 'Hermes didn’t accept this website’s key. Tell your mentor.',
  unknown_profile: 'This Hermes agent isn’t set up yet. Tell your mentor.',
  busy: 'Hermes is busy right now. Try again in a minute.',
  timeout: 'Hermes took too long to answer. Try a shorter question.',
  upstream_failed: 'Hermes didn’t answer. Try again.',
  aborted: 'Stopped.'
};
export const friendly = error => MESSAGES[error] || MESSAGES.upstream_failed;
export const httpStatus = error => ({ not_configured: 503, busy: 429, timeout: 504 }[error] || 502);
const errorFor = status => status === 401 || status === 403 ? 'invalid_key'
  : status === 404 ? 'unknown_profile'
  : status === 429 || status === 503 ? 'busy' : 'upstream_failed';

// One AbortController that fires on a timeout or when the caller's signal aborts
// (e.g. the browser disconnected), so the upstream request is always cancelled.
function linked(signal, ms) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort(); else signal?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    done() { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
  };
}

// Some models think out loud inside <think>…</think>. Students only see the answer.
export const stripThink = text => String(text || '')
  .replace(/<think>[\s\S]*?<\/think>/g, '')
  .replace(/^[\s\S]*?<\/think>/, '')
  .replace(/<think>[\s\S]*$/, '')
  .trim();

// The same, for text that arrives in pieces: a tag can be split across two chunks.
function thinkFilter() {
  let inThink = false, buf = '';
  const partial = (s, tag) => { for (let k = Math.min(tag.length - 1, s.length); k > 0; k--) if (s.endsWith(tag.slice(0, k))) return k; return 0; };
  return {
    push(text) {
      buf += text;
      let out = '';
      for (;;) {
        if (inThink) {
          const i = buf.indexOf('</think>');
          if (i < 0) { buf = buf.slice(-7); return out; }
          buf = buf.slice(i + 8); inThink = false;
        } else {
          const i = buf.indexOf('<think>');
          if (i < 0) { const k = partial(buf, '<think>'); out += buf.slice(0, buf.length - k); buf = buf.slice(buf.length - k); return out; }
          out += buf.slice(0, i); buf = buf.slice(i + 7); inThink = true;
        }
      }
    },
    flush() { const out = inThink ? '' : buf; buf = ''; return out; }
  };
}

async function post(use, body, { signal, timeoutMs = UPSTREAM_TIMEOUT_MS } = {}) {
  if (!configured(use)) return { error: 'not_configured' };
  const { profile } = AGENTS[use];
  const link = linked(signal, timeoutMs);
  try {
    const response = await fetch(`${baseUrl()}/p/${profile}/v1/chat/completions`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + keyFor(use), 'Content-Type': 'application/json', Accept: body.stream ? 'text/event-stream' : 'application/json' },
      body: JSON.stringify({ model: profile, ...body }),
      signal: link.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      console.error(`Hermes ${profile} failed: ${response.status} ${detail.slice(0, 200)}`);
      link.done();
      return { error: errorFor(response.status) };
    }
    return { response, link, profile };
  } catch (e) {
    link.done();
    if (signal?.aborted) return { error: 'aborted' };
    if (link.timedOut()) return { error: 'timeout' };
    console.error(`Hermes ${profile} request error:`, e.message);
    return { error: 'upstream_failed' };
  }
}

// Waits for the whole answer. Returns { text, profile } or { error }.
export async function hermesChat(use, messages, options = {}) {
  const r = await post(use, { messages, stream: false }, options);
  if (r.error) return r;
  try {
    const data = await r.response.json();
    const text = stripThink(data?.choices?.[0]?.message?.content);
    return text ? { text, profile: r.profile } : { error: 'upstream_failed' };
  } catch {
    return { error: options.signal?.aborted ? 'aborted' : r.link.timedOut() ? 'timeout' : 'upstream_failed' };
  } finally {
    r.link.done();
  }
}

// Streams the answer. Calls onEvent with:
//   { type: 'status', text }                  the agent is thinking (reasoning is never forwarded)
//   { type: 'tool', tool, emoji, label }      a tool started running, e.g. a web search
//   { type: 'token', text }                   the next piece of the answer
// Resolves to { ok: true } or { error }.
export async function hermesStream(use, messages, { onEvent = () => {}, ...options } = {}) {
  const r = await post(use, { messages, stream: true }, options);
  if (r.error) return r;
  const { response, link } = r;
  const think = thinkFilter();
  let sentAny = false, thinking = false;
  const token = text => { const visible = think.push(text); if (visible) { sentAny = true; onEvent({ type: 'token', text: visible }); } };
  try {
    // A server that ignores "stream": true answers with plain JSON. Treat it as one big token.
    if (!/event-stream/i.test(response.headers.get('content-type') || '')) {
      const data = await response.json();
      token(String(data?.choices?.[0]?.message?.content || ''));
    } else {
      const reader = response.body.getReader(), decoder = new TextDecoder();
      let buffer = '', finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n?/g, '\n');
        let cut;
        while (!finished && (cut = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
          let event = 'message'; const data = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event:')) event = line.slice(6).trim();
            else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /, ''));
          }
          const payload = data.join('\n');
          if (!payload) continue;
          if (event === 'hermes.tool.progress') {
            try {
              const p = JSON.parse(payload);
              if (p.status === 'running') onEvent({ type: 'tool', tool: String(p.tool || '').slice(0, 60), emoji: String(p.emoji || '').slice(0, 8), label: String(p.label || '').slice(0, 200) });
            } catch {}
            continue;
          }
          if (payload.trim() === '[DONE]') { finished = true; break; }
          let chunk; try { chunk = JSON.parse(payload); } catch { continue; }
          const delta = chunk?.choices?.[0]?.delta || {};
          if (delta.reasoning_content && !thinking && !sentAny) { thinking = true; onEvent({ type: 'status', text: 'Thinking…' }); }
          if (typeof delta.content === 'string' && delta.content) token(delta.content);
        }
      }
      reader.cancel().catch(() => {});
    }
    const rest = think.flush();
    if (rest) { sentAny = true; onEvent({ type: 'token', text: rest }); }
    return sentAny ? { ok: true } : { error: 'upstream_failed' };
  } catch {
    return { error: options.signal?.aborted ? 'aborted' : link.timedOut() ? 'timeout' : 'upstream_failed' };
  } finally {
    link.done();
  }
}

// GET a Hermes endpoint (outside the chat API) with a profile's key. Returns { data } or { error }.
export async function hermesGet(use, path, { timeoutMs = 10000 } = {}) {
  if (!configured(use)) return { error: 'not_configured' };
  const link = linked(null, timeoutMs);
  try {
    const r = await fetch(baseUrl() + path, { headers: { Authorization: 'Bearer ' + keyFor(use), Accept: 'application/json' }, signal: link.signal });
    if (!r.ok) { console.error(`Hermes GET ${path} failed: ${r.status}`); return { error: errorFor(r.status) }; }
    return { data: await r.json() };
  } catch (e) {
    if (!link.timedOut()) console.error(`Hermes GET ${path} error:`, e.message);
    return { error: link.timedOut() ? 'timeout' : 'upstream_failed' };
  } finally {
    link.done();
  }
}

// Is Hermes reachable? GET ${HERMES_URL}/health with a 3-second timeout. Never throws.
export async function hermesHealth() {
  const base = baseUrl();
  if (!base) return { ok: false, configured: false, ms: null };
  const link = linked(null, 3000), started = Date.now();
  try {
    const r = await fetch(base + '/health', { signal: link.signal, headers: { Accept: 'application/json' } });
    return { ok: r.ok, configured: true, ms: Date.now() - started, status: r.status };
  } catch {
    return { ok: false, configured: true, ms: null, error: link.timedOut() ? 'timeout' : 'unreachable' };
  } finally {
    link.done();
  }
}

// /api/health is public, so a burst of page loads shares one check instead of each pinging Hermes.
let cached = { at: 0, value: null };
export async function hermesHealthCached(maxAgeMs = 15000) {
  if (cached.value && Date.now() - cached.at < maxAgeMs) return cached.value;
  const value = await hermesHealth();
  cached = { at: Date.now(), value };
  return value;
}

// The exact command the Hermes operator runs to let a student's Telegram account in.
export const pairingCommand = code => `hermes -p ${AGENTS.assistant.profile} pairing approve telegram ${code}`;

// The Telegram bot that runs Iris (h101-assistant). Not a secret: students open it from the page.
export function botUsername() {
  const name = clean(process.env.TELEGRAM_BOT_USERNAME).replace(/^@/, '');
  return /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(name) ? name : null;
}
// Where a student's pairing request is stored: { code, username, status: 'pending' | 'approved', at }.
export const telegramKey = userId => `telegram:${userId}`;
