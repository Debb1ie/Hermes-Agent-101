# Hermes Agent 101

**Learn AI agents with Hermes.** A hands-on workshop app that teaches students to set up and run their
own agent with Hermes: install it, make a profile, write a SOUL.md and test it live, choose tools, lock it
down with real safety settings, schedule jobs, put it on Telegram, connect apps, and get a certificate.

[Hermes Agent](https://github.com/NousResearch/hermes-agent) (the open-source agent framework by Nous
Research) is both the AI engine and the subject of the workshop. No student ever needs an API key.

One page (`index.html`, vanilla JS) plus Vercel serverless functions in `api/`, with Supabase storage.

| File | What it does |
|---|---|
| `api/_hermes.js` | The **only** module that talks to Hermes: chat (waiting or streaming), health check, error mapping, 240 s timeout. |
| `api/chat.js` | **SOUL.md tester**. Sends the student's draft SOUL.md (as a system message) + chat to the `h101-lab` profile. |
| `api/agents-chat.js` | **Real Hermes agents** (Atlas, Forge, Iris). Streams answers and live tool activity to the browser. |
| `api/automations.js` | Latest output of Iris's scheduled jobs, from Hermes. Cached 60 s. |
| `api/telegram.js` | A student saves the pairing code the Telegram bot sent them. |
| `api/insights.js` | Dashboard assistant, on the `h101-mentor` profile. |
| `api/admin.js` | Staff actions: Hermes tab (status, pairing approvals, usage), account view, password and progress resets. |
| `api/auth.js` | Student sign-up/login, admin-created mentor accounts, password changes. |
| `api/data.js` | Role-protected dashboard data. |
| `api/feedback.js`, `api/progress.js` | Survey answers and lab progress. |
| `api/health.js` | `{ ok, ai, db }`. `ai` is true when Hermes answers `GET ${HERMES_URL}/health` within 3 s. |
| `scripts/create-admin.py` | Run locally once to create or update the super admin in Supabase. |

The builders (SOUL.md, tools, safety, cron), certificates, and progress run in the browser, so students
never get stuck if Hermes is slow, busy, or offline. Only the SOUL.md tester and the real agents need Hermes.

## The course, step by step
Students learn to set up and run Hermes themselves. Every step shows real screenshots of the commands
(`img/terminal/`, captured from a real Hermes install) so anyone who falls behind can catch up.

1. **Meet Hermes** `/meet-hermes`: Hermes as its official site presents it (“The Agent That Grows With You”, a screenshot of hermes-agent.nousresearch.com, the six official features, three ways to run it, the FAQ), then agent vs. chatbot and a live agent trace.
2. **Install Hermes** `/install`: the install command for macOS, Linux/WSL2, Windows, or Android, then `hermes setup`, `hermes model`, `hermes doctor`, and a first chat. Includes a checklist.
3. **Where things live** `/where-things-live`: a clickable tour of `~/.hermes` (`config.yaml`, `.env`, `SOUL.md`, `memories/`, `skills/`, `cron/`, `sessions/`, `logs/`, `profiles/`).
4. **Profiles** `/profiles`: one agent per job. Students name their own profile and get the commands for it.
5. **Write a SOUL.md** `/soul`: a builder (from an example or blank) that generates their SOUL.md, then **tests it live on Hermes** (`h101-lab`).
6. **Choose tools** `/tools`: switch toolsets on and off (with risk levels) and get the `config.yaml` lines and `hermes tools` commands.
7. **Make it safe** `/safety`: 7 real risks. Students pick the Hermes setting that stops each one (approvals, `deny`, allowlists/pairing, `max_turns`, secret redaction, `redact_pii`, least privilege) and get a hardened config.
8. **Real Hermes agents** `/real-agents`: Atlas, Forge, and Iris, live and streaming, each with a "how it's set up" panel.
9. **Memory & skills** `/memory-and-skills`: `MEMORY.md`, `USER.md`, `/new`, `hermes skills`, and an example `SKILL.md`.
10. **Scheduled jobs** `/automations`: a cron builder (`hermes cron create …`) and Iris's latest real outputs.
11. **Hermes on Telegram** `/telegram`: pair with Iris in class, plus how to set up their own bot at home.
12. **Connect apps** `/connect-apps`: the API server, `API_SERVER_KEY`, a `curl` call, and how this website talks to Hermes.
13. **Takeaways** `/takeaways`: a "copy my setup" bundle (profile commands, SOUL.md, settings, cron job).

Then the **certificate** (needs: SOUL.md, tools, safety check passed, one real agent tried), **Resources**
(Hermes docs by topic), and **Policies**. The dashboard's **Builds** tab shows each student's agent,
profile name, tools, and safety score.

To refresh the screenshots after a Hermes update, re-run the commands shown in each image on a Hermes
install and replace the PNGs in `img/terminal/`. Never include keys, other profiles, or personal paths.

## 1. Connect Supabase (accounts, progress, feedback)
Supabase is required on Vercel. Without it, sign-up returns "Storage is not configured."

1. At https://supabase.com/dashboard click **New project**. Pick the region closest to your students
   (e.g. Southeast Asia (Singapore)). Leave **Enable Data API** on.
2. Open **SQL Editor > New query**, paste all of [supabase.sql](./supabase.sql), click **Run**. It creates
   the `app_store` key/value table (Row Level Security on, no policies) and the `app_store_increment`
   function used for daily usage counts. It is safe to run again.
3. Copy the **Project URL** into `SUPABASE_URL`, e.g. `https://abcdefghijklmnop.supabase.co`.
4. **Project Settings > API Keys**: copy the **secret** key (`sb_secret_…`), or the legacy `service_role`
   key (starts with `eyJ`), into `SUPABASE_SERVICE_KEY`. Never the publishable/`anon` key.
5. Check after deploying: `https://<your-site>/api/health` should show `"db":true`.

If something fails, open Vercel **Project > Logs**. `Supabase … failed: 401` means the key is wrong;
`404` / `PGRST205` means `supabase.sql` wasn't run in this project.

### Create the super admin (once)
With `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` in your local `.env`, run in this folder:

```
python3 scripts/create-admin.py
```

Enter the admin email, a name, and a 12+ character password (hidden as you type). Only a one-way PBKDF2
hash is stored. Run it again any time to change the password. (Alternative: set `ADMIN_EMAIL` and
`ADMIN_PASSWORD` in Vercel.)

## 2. Environment variables
All of them are server-only. None is ever sent to a browser. See [.env.example](./.env.example).

| Variable | Needed | What it is |
|---|---|---|
| `HERMES_URL` | For AI | Hermes base URL, no trailing slash, e.g. `https://xxxx.trycloudflare.com` |
| `HERMES_KEY_LAB` | For AI | Key for `h101-lab` (SOUL.md tester) |
| `HERMES_KEY_MENTOR` | For AI | Key for `h101-mentor` (dashboard assistant) |
| `HERMES_KEY_RESEARCHER` | For AI | Key for `h101-researcher` (Atlas) |
| `HERMES_KEY_CODER` | For AI | Key for `h101-coder` (Forge) |
| `HERMES_KEY_ASSISTANT` | For AI | Key for `h101-assistant` (Iris, Telegram, daily jobs, `/h101/automations`) |
| `TELEGRAM_BOT_USERNAME` | For Telegram | The bot's username without `@`. Shown to students; not a secret. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` | Yes | Storage (see above) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Optional | Sign in as admin with environment credentials instead of `create-admin.py` |
| `ALLOWED_ORIGIN` | Recommended | Your site URL. Blocks other sites from using `/api/chat` and `/api/agents-chat`. |
| `PASSWORD_VIEW_KEY` | Optional | Lets facilitators view student passwords (`openssl rand -base64 32`) |
| `WORKSHOP_TZ` | Optional | Time zone for "messages today" on the dashboard. Default `Asia/Manila`. |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Optional | Legacy storage fallback (Vercel KV / Upstash) |

Without `HERMES_URL`, everything still works with the practice agent; the Real agents, Automations and
Live AI parts show a friendly "Hermes isn't connected yet" message.

## 3. Deploy to Vercel
1. Push this folder to GitHub and **Import** it at https://vercel.com/new (framework: Other, no build step).
2. Add the environment variables above (Production and Preview), then deploy.
3. Check `https://<your-site>/api/health`: `{"ok":true,"ai":true,"db":true}`. Then send a message in **Write a SOUL.md › Test it on Hermes**.
4. Add `ALLOWED_ORIGIN` with your `https://….vercel.app` URL and redeploy.

`vercel.json` gives `api/chat.js`, `api/agents-chat.js` and `api/insights.js` up to 300 seconds, because
free models can take 20–90 s per answer. On the Hobby plan this needs Fluid Compute (on by default for new
projects); otherwise Vercel caps functions at 60 s. After changing a variable in Vercel, redeploy.

### Run it locally
Quickest way, with no Vercel CLI (needs Node 20+; Hermes ships one in `~/.hermes/tools/`):

```bash
node scripts/local-preview.mjs              # http://localhost:3000, with the login screen
node scripts/local-preview.mjs 3000 student # skip login, as "Preview Student"
node scripts/local-preview.mjs 3001 admin   # skip login, as "Preview Admin"
```

It reads `.env`, serves the page with the same rewrites and headers as `vercel.json`, and runs the
`api/` functions. Without Supabase, accounts live in memory until you stop it.

Or with the Vercel CLI:
Install Node.js 20+ and the Vercel CLI (`npm i -g vercel`), then in this folder: `vercel link`, copy
`.env.example` to `.env` and fill it in, and run `vercel dev`. The site runs at http://localhost:3000.
Without Supabase, `vercel dev` keeps accounts in memory until you stop it.

To skip the login screen while you look around locally, add `DEV_AUTO_LOGIN=student` (the lab) or
`DEV_AUTO_LOGIN=admin` (the dashboard) to `.env`. It is ignored on any Vercel deployment.

Opening `index.html` through a plain static server (e.g. Live Server on `127.0.0.1:5500`) gives a clearly
labeled **local preview**: you can click through the student lab and a sample dashboard, but nothing is
saved and Hermes isn't used.

## 4. The admin / mentor dashboard
Sign in with **Admin / mentor**. It refreshes itself every 10 seconds.

- **Overview**: where students are, feedback completion, SOUL.md starting points, ratings, confidence, and the
  **dashboard assistant** (Hermes `h101-mentor`), which reads names, progress and survey answers, never emails.
- **Students**, **Feedback** (with CSV download), **Mentors**: as in Agent Lab.
- **Builds**: each student's agent name, profile, toolsets, and safety-check score.
- **Hermes** (admin only):
  - **Status**: online/offline and response time of `GET ${HERMES_URL}/health`, and which profile keys
    are set (never the keys themselves).
  - **Telegram pairing requests**: student, Telegram username, code, status. **Approve** marks it approved
    and shows the exact command for the Hermes operator, with a Copy button:
    `hermes -p h101-assistant pairing approve telegram <CODE>`. The Hermes host runs it; this website
    never runs shell commands. Pairing codes expire one hour after the bot sends them.
  - **Usage today**: Live AI messages per lab, and Real agents messages (Atlas, Forge, Iris).

**Opening an account.** Click **Open** next to a student and re-enter your password (unlocked for 10
minutes): account, progress, Telegram pairing, feedback, **Show password**, **Reset to a temporary
password**, and **Reset lab progress** (recorded in the reset history). Mentors can show/reset passwords
and reset progress for students in their own lab only, and never see the Hermes tab.

## 5. Hermes side (for the Hermes operator)
The website calls Hermes's OpenAI-compatible API, one profile per agent, all behind one base URL:

```
POST ${HERMES_URL}/p/<profile>/v1/chat/completions
Authorization: Bearer <that profile's key>
Content-Type: application/json
{ "model": "<profile>", "messages": [...], "stream": true | false }
```

- Non-streaming: the answer is read from `choices[0].message.content` (`<think>…</think>` is removed).
- Streaming (SSE): `data: {chat.completion.chunk}` with `choices[0].delta.content` (the answer) and
  `delta.reasoning_content` (never shown; students just see "thinking"), ending with `data: [DONE]`.
  Tool progress arrives as `event: hermes.tool.progress` +
  `data: {"tool":"web_search","emoji":"🔍","label":"…","status":"running"|"completed"}`; only `running`
  is shown ("🔍 Searching the web: …").
- A `system` message from the site is layered on top of the profile's own instructions. Only the
  SOUL.md tester (`h101-lab`) sends one: the student's draft SOUL.md. Real agents never get a client system message.
- Errors: `401` bad key, `404` unknown profile, `429`/`503` busy. The site shows a friendly message.
- The site waits up to 240 s and cancels the upstream request if the student leaves or presses **Stop**.

| Use | Profile | Website env var | Tools |
|---|---|---|---|
| SOUL.md tester (acts as the student's SOUL.md) | `h101-lab` | `HERMES_KEY_LAB` | None |
| Dashboard assistant | `h101-mentor` | `HERMES_KEY_MENTOR` | None |
| Atlas, researcher: cited answers | `h101-researcher` | `HERMES_KEY_RESEARCHER` | Web search + extract |
| Forge, coder: writes and explains code | `h101-coder` | `HERMES_KEY_CODER` | No terminal (it can't run code) |
| Iris, daily assistant + Telegram + daily jobs | `h101-assistant` | `HERMES_KEY_ASSISTANT` | As needed for planning and drafting |

Hermes also needs to serve:
- `GET ${HERMES_URL}/health`: any `2xx` means online (no auth needed).
- `GET ${HERMES_URL}/h101/automations` with `Authorization: Bearer <HERMES_KEY_ASSISTANT>`, returning
  `{ "automations": [{ "id", "name", "schedule", "ranAt", "markdown" }] }`. The page matches Iris's jobs
  by id or name: `morning-briefing` / Morning Briefing (`0 8 * * *`), `midday-tip` / Midday Tip
  (`0 12 * * *`), `evening-wrap-up` / Evening Wrap-up (`0 18 * * *`). `markdown` is shown with a safe
  Markdown renderer (HTML is shown as text).
- The Telegram gateway on `h101-assistant`, with DM pairing on. Students get an 8-character code from the
  bot, a mentor approves it on the dashboard, and the operator runs
  `hermes -p h101-assistant pairing approve telegram <CODE>`.

### Running Hermes on your own computer: `hermes-side/`
If Hermes runs on a Mac or PC (not a server), `hermes-side/` connects it to the website safely:

```bash
hermes-side/start.sh      # starts the edge on 127.0.0.1:8650 + a Cloudflare tunnel, prints HERMES_URL
hermes-side/make-env.sh   # writes HERMES_URL and the 5 profile keys into .env (never committed)
hermes-side/stop.sh       # stops the edge and tunnel; Hermes keeps running
```

`edge.mjs` is the only thing the tunnel exposes. It allows `GET /health`, `GET /h101/automations`
(built from `h101-assistant`'s cron output, Bearer = its `API_SERVER_KEY`), and
`POST /p/h101-*/v1/chat/completions` for the five workshop profiles. Every other route, including your
other Hermes profiles, gets 404. It needs Node 18+ and `cloudflared` (`brew install cloudflared`).

A quick tunnel's URL changes every time `start.sh` runs: update `HERMES_URL` in Vercel and redeploy.
For a URL that never changes, use a named Cloudflare tunnel with your own domain. The computer must stay
on and awake during the workshop (`start.sh` runs `caffeinate`).

## Security notes
- Hermes keys, the Supabase key and admin credentials live only in Vercel environment variables.
- HttpOnly, SameSite=Lax session cookies (`Secure` everywhere except `vercel dev`); PBKDF2 password
  hashes; strict Content-Security-Policy and security headers (see `vercel.json`).
- Real agents: only `user`/`assistant` messages are forwarded (client `system` messages are dropped), the
  last 12 messages, 2,000 characters each, 15 messages per 10 minutes per student. SOUL.md tester:
  20 requests per minute per student.
- Agent answers and automation output are rendered by a small Markdown renderer that escapes everything
  first and only allows `http(s)` links (opened with `rel="noopener noreferrer nofollow"`).
- The QR code is generated in the browser; the bot link isn't sent to any outside service.

Not affiliated with or endorsed by Nous Research.
