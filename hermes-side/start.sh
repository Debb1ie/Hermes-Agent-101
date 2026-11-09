#!/bin/bash
# Starts the Hermes edge (127.0.0.1:8650) and a Cloudflare quick tunnel to it,
# then writes the public URL to run/hermes_url and prints it.
# Hermes itself must already be running (hermes gateway start).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p run logs
PORT="${EDGE_PORT:-8650}"
NODE="$(command -v node || echo "$HOME/.hermes/tools/node-26.7.0-darwin-x64/bin/node")"
CLOUDFLARED="$(command -v cloudflared || echo "$HOME/hermes-agent-101/bin/cloudflared")"
[ -x "$CLOUDFLARED" ] || { echo "cloudflared not found. Install it: brew install cloudflared"; exit 1; }
curl -fs -m 3 http://127.0.0.1:8642/health >/dev/null || { echo "Hermes isn't answering on 127.0.0.1:8642. Start it: hermes gateway start"; exit 1; }

./stop.sh >/dev/null 2>&1 || true
: > logs/tunnel.log
nohup "$NODE" edge.mjs >> logs/edge.log 2>&1 & echo $! > run/edge.pid
sleep 1
nohup "$CLOUDFLARED" tunnel --no-autoupdate --edge-ip-version 4 --protocol http2 --url "http://127.0.0.1:$PORT" >> logs/tunnel.log 2>&1 & echo $! > run/tunnel.pid
# Keep the computer awake while the edge runs.
nohup caffeinate -is -w "$(cat run/edge.pid)" >/dev/null 2>&1 &

echo -n "Waiting for the public URL"
URL=""
for _ in $(seq 1 40); do
  URL=$(grep -o 'https://[a-z0-9-]*\.trycloudflare\.com' logs/tunnel.log | head -1 || true)
  [ -n "$URL" ] && break; echo -n "."; sleep 1
done
echo
[ -n "$URL" ] || { echo "No tunnel URL yet. Check hermes-side/logs/tunnel.log"; exit 1; }
echo "$URL" > run/hermes_url
echo "Hermes edge is live."
echo "  HERMES_URL=$URL"
echo "Put that in Vercel (Settings > Environment Variables), then redeploy."
echo "The URL changes every time this script runs. ./make-env.sh writes it into ../.env for you."
