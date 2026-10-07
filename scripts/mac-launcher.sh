#!/bin/bash
# TypeRush.app launcher: serves the built app on 127.0.0.1 and opens it in its own window.
# __NODE__ is replaced with the absolute path to node when the app is built (Finder apps get no shell PATH).
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
NODE="__NODE__"
PORT=4747
URL="http://127.0.0.1:$PORT/"
SERVER=""

cleanup() { [ -n "$SERVER" ] && kill "$SERVER" 2>/dev/null; }
trap cleanup EXIT INT TERM

ping() { [ "$(curl -s --max-time 1 "${URL}__typerush")" = "ok" ]; }

if ! ping; then
  "$NODE" "$RES/serve.mjs" "$RES/dist" "$PORT" &
  SERVER=$!
  for _ in $(seq 1 50); do ping && break; sleep 0.1; done
fi

CHROME="/Applications/Google Chrome.app"
if [ -d "$CHROME" ]; then
  # Own profile so the window behaves like a separate app; returns when that Chrome instance quits.
  open -W -n -a "$CHROME" --args --app="$URL" \
    --user-data-dir="$HOME/Library/Application Support/TypeRush/Chrome" \
    --no-first-run --no-default-browser-check
else
  open "$URL"
  [ -n "$SERVER" ] && wait "$SERVER"
fi
