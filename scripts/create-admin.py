#!/usr/bin/env python3
"""Create or update the super admin account in Supabase.

Run it from the project folder:  python3 scripts/create-admin.py

It reads SUPABASE_URL and SUPABASE_SERVICE_KEY from .env, asks for the admin's
email, name and password (the password is not shown as you type), and stores
the account with a one-way PBKDF2 hash, the same format the app uses for every
account. The password itself is never saved or sent anywhere.
Run it again at any time to change the admin password.
"""
import getpass
import hashlib
import json
import os
import re
import secrets
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_env():
    env = {}
    path = os.path.join(ROOT, '.env')
    if os.path.exists(path):
        for line in open(path, encoding='utf-8'):
            match = re.match(r'^([A-Z0-9_]+)=(.*)$', line.strip())
            if match and match.group(2).strip():
                env[match.group(1)] = match.group(2).strip()
    env.update({k: v for k, v in os.environ.items() if k.startswith('SUPABASE_')})
    return env


def supabase(env, method, path, body=None, prefer=None):
    key = env['SUPABASE_SERVICE_KEY']
    headers = {'apikey': key, 'Content-Type': 'application/json', 'User-Agent': 'hermes-agent-101-create-admin'}
    if key.startswith('eyJ'):  # legacy service_role JWT
        headers['Authorization'] = 'Bearer ' + key
    if prefer:
        headers['Prefer'] = prefer
    url = env['SUPABASE_URL'].rstrip('/') + '/rest/v1/' + path
    request = urllib.request.Request(url, method=method, headers=headers, data=json.dumps(body).encode() if body is not None else None)
    with urllib.request.urlopen(request, timeout=20) as response:
        raw = response.read()
        return json.loads(raw) if raw else None


def get_value(env, key):
    rows = supabase(env, 'GET', 'app_store?select=value&limit=1&key=eq.' + urllib.parse.quote(key, safe=''))
    return rows[0]['value'] if rows else None


def put_value(env, key, value):
    supabase(env, 'POST', 'app_store?on_conflict=key', {'key': key, 'value': value}, 'resolution=merge-duplicates,return=minimal')


def password_hash(password):
    # Matches api/_store.js: pbkdf2(password, salt-as-text, 120000, 32 bytes, sha256), stored as "salt:hash".
    salt = secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 120000, 32).hex()
    return f'{salt}:{derived}'


def main():
    env = load_env()
    if not env.get('SUPABASE_URL') or not env.get('SUPABASE_SERVICE_KEY'):
        sys.exit('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env first.')

    email = input('Admin email: ').strip().lower()
    if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
        sys.exit('That does not look like an email address.')
    try:
        existing = get_value(env, f'user:email:{email}')
    except urllib.error.HTTPError as error:
        sys.exit(f'Could not reach Supabase (HTTP {error.code}). Check SUPABASE_URL, SUPABASE_SERVICE_KEY, and that supabase.sql was run.')
    if existing and existing.get('role') != 'admin':
        sys.exit(f'{email} is already registered as a {existing.get("role")}. Use a different email for the admin.')

    default_name = (existing or {}).get('name') or 'Workshop Super Admin'
    name = input(f'Display name [{default_name}]: ').strip() or default_name
    password = getpass.getpass('New admin password (12+ characters, not shown): ')
    if len(password) < 12:
        sys.exit('Use at least 12 characters. A passphrase of 3-4 unrelated words works well.')
    if getpass.getpass('Type it again: ') != password:
        sys.exit('The passwords did not match. Nothing was changed.')

    user = dict(existing or {})
    user.update({
        'id': user.get('id') or secrets.token_hex(12),
        'name': name,
        'email': email,
        'role': 'admin',
        'lab': None,
        'password': password_hash(password),
        'createdAt': user.get('createdAt') or datetime.now(timezone.utc).isoformat(),
    })
    put_value(env, f'user:{user["id"]}', user)
    put_value(env, f'user:email:{email}', user)
    print(f'{"Updated" if existing else "Created"} the super admin account for {email}. Sign in on the site with this email and password.')


if __name__ == '__main__':
    main()
