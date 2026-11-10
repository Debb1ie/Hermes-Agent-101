#!/usr/bin/env bash
# Connect Iris (the h101-assistant profile) to your Telegram bot.
# The token is typed hidden, checked with Telegram, saved only in the profile's .env,
# and never printed. Run it yourself in a terminal:
#   bash hermes-side/set-telegram.sh
# Or copy the token in Telegram first and run:
#   bash hermes-side/set-telegram.sh --clipboard
set -euo pipefail
PROFILE=h101-assistant
PENV="$HOME/.hermes/profiles/$PROFILE/.env"
SITE_ENV="$(cd "$(dirname "$0")/.." && pwd)/.env"
export PATH="$HOME/.local/bin:$PATH"

[ -f "$PENV" ] || { echo "Profile $PROFILE not found at $PENV"; exit 1; }
FROM_CLIP=0
if [ "${1:-}" = "--clipboard" ]; then
  # macOS: take the token you copied in Telegram, without showing it.
  FROM_CLIP=1; TOKEN="$(pbpaste 2>/dev/null || true)"
else
  [ -t 0 ] || { echo "Run this in a terminal so the token can be typed hidden (or use --clipboard)."; exit 1; }
  printf 'Paste the bot token from @BotFather (it stays hidden), then press Enter: '
  IFS= read -rs TOKEN; echo
fi
TOKEN="${TOKEN//[[:space:]]/}"
if [[ ! "$TOKEN" =~ ^[0-9]{6,12}:[A-Za-z0-9_-]{30,}$ ]]; then
  echo "That doesn't look like a bot token (it should be numbers:letters). Nothing changed."; exit 1
fi

# Check the token with Telegram. The URL goes through stdin, so the token never shows in the process list.
RESP=$(printf 'url = "https://api.telegram.org/bot%s/getMe"\n' "$TOKEN" | curl -sS --max-time 20 -K - || true)
BOT=$(printf '%s' "$RESP" | python3 -I -c 'import sys,json
try:
    d=json.load(sys.stdin); print(d["result"]["username"] if d.get("ok") else "")
except Exception: print("")')
[ -n "$BOT" ] || { echo "Telegram didn't accept that token. Check it in @BotFather. Nothing changed."; exit 1; }

# Save it in Iris's .env (replacing an old one), readable only by you.
TOKEN="$TOKEN" python3 -I - "$PENV" <<'PY'
import os, sys
p = sys.argv[1]
lines = [l for l in open(p, encoding='utf-8').read().splitlines() if not l.startswith('TELEGRAM_BOT_TOKEN=')]
lines.append('TELEGRAM_BOT_TOKEN=' + os.environ['TOKEN'])
open(p, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
PY
chmod 600 "$PENV"
unset TOKEN
# Don't leave the token sitting in the clipboard.
[ "$FROM_CLIP" = 1 ] && printf '' | pbcopy

# The website only needs the bot's public username (for the QR code and the Open button).
if [ -f "$SITE_ENV" ]; then
  BOT="$BOT" python3 -I - "$SITE_ENV" <<'PY'
import os, sys
p = sys.argv[1]
lines = [l for l in open(p, encoding='utf-8').read().splitlines() if not l.startswith('TELEGRAM_BOT_USERNAME=')]
lines.append('TELEGRAM_BOT_USERNAME=' + os.environ['BOT'])
open(p, 'w', encoding='utf-8').write('\n'.join(lines) + '\n')
PY
fi

echo "Token OK: your bot is @$BOT"
echo "Restarting Iris's gateway so she connects to Telegram..."
hermes -p "$PROFILE" gateway restart >/dev/null 2>&1 || hermes -p "$PROFILE" gateway start >/dev/null 2>&1 || true
sleep 3
hermes -p "$PROFILE" gateway status 2>&1 | grep -iE 'telegram|running|stopped' | head -5 || true
echo
echo "Next: open https://t.me/$BOT in Telegram and press Start."
echo "The bot replies with an 8-character pairing code. Approve yourself with:"
echo "  hermes -p $PROFILE pairing approve telegram <CODE>"
