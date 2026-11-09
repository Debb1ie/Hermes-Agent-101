#!/bin/bash
# Stops the Hermes edge and its tunnel. Hermes itself keeps running.
cd "$(dirname "$0")"
for f in run/tunnel.pid run/edge.pid; do
  [ -s "$f" ] && kill "$(cat "$f")" 2>/dev/null && echo "stopped $(basename "$f" .pid)"
  [ -f "$f" ] && : > "$f"
done
exit 0
