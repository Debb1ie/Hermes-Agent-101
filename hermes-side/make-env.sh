#!/bin/bash
# Writes the Hermes values into ../.env (the website's settings file, never committed):
# HERMES_URL from the running tunnel, and each profile's API_SERVER_KEY from ~/.hermes/profiles.
# Other lines already in ../.env (Supabase, admin, ...) are kept. Paste the file into Vercel's
# Environment Variables page ("Import .env") or use it with `vercel dev`.
set -euo pipefail
cd "$(dirname "$0")"
URL="${1:-$(cat run/hermes_url 2>/dev/null || true)}"
[ -n "$URL" ] || { echo "No tunnel URL. Run ./start.sh first, or pass the URL: ./make-env.sh https://…"; exit 1; }
python3 - "$URL" <<'PY'
import os, re, secrets, sys, pathlib
url = sys.argv[1].rstrip('/')
home = pathlib.Path(os.environ.get('HERMES_HOME', pathlib.Path.home() / '.hermes')) / 'profiles'
def key(profile):
    try:
        m = re.search(r'^API_SERVER_KEY=(.*)$', (home / profile / '.env').read_text(), re.M)
        return m.group(1).strip().strip('"\'') if m else ''
    except FileNotFoundError:
        return ''
values = {'HERMES_URL': url, 'HERMES_KEY_LAB': key('h101-lab'), 'HERMES_KEY_MENTOR': key('h101-mentor'),
          'HERMES_KEY_RESEARCHER': key('h101-researcher'), 'HERMES_KEY_CODER': key('h101-coder'), 'HERMES_KEY_ASSISTANT': key('h101-assistant')}
env = pathlib.Path('..') / '.env'
lines = env.read_text().splitlines() if env.exists() else (pathlib.Path('..') / '.env.example').read_text().splitlines()
seen = set(); out = []
for line in lines:
    m = re.match(r'^([A-Z0-9_]+)=', line)
    if m and m.group(1) in values:
        out.append(f'{m.group(1)}={values[m.group(1)]}'); seen.add(m.group(1))
    elif m and m.group(1) == 'PASSWORD_VIEW_KEY' and line.strip() == 'PASSWORD_VIEW_KEY=':
        out.append('PASSWORD_VIEW_KEY=' + secrets.token_urlsafe(32))
    else:
        out.append(line)
out += [f'{k}={v}' for k, v in values.items() if k not in seen]
env.write_text('\n'.join(out) + '\n'); env.chmod(0o600)
missing = [k for k, v in values.items() if not v]
print('Wrote ../.env with HERMES_URL and', 6 - len(missing) - 1, 'of 5 profile keys.' + (' Missing: ' + ', '.join(missing) if missing else ''))
PY
