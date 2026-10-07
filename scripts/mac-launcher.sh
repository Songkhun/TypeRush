#!/bin/bash
# TypeRush.app launcher: makes sure the local server is up, opens the app window, then exits at once.
# It must not stay running: macOS treats a running app process as "TypeRush is open" and a script
# cannot answer a re-open request, which shows "The application TypeRush is not open anymore".
# __NODE__ is replaced with the absolute path to node when the app is built (Finder apps get no shell PATH).
RES="$(cd "$(dirname "$0")/../Resources" && pwd)"
NODE="__NODE__"
PORT=4747
URL="http://127.0.0.1:$PORT/"
CHROME="/Applications/Google Chrome.app"
PROFILE="$HOME/Library/Application Support/TypeRush/Chrome"

ping() { [ "$(curl -s --max-time 1 "${URL}__typerush")" = "ok" ]; }

if ! ping; then
  WATCH=()
  [ -d "$CHROME" ] && WATCH=("$PROFILE") # server stops itself once that Chrome window app quits
  nohup "$NODE" "$RES/serve.mjs" "$RES/dist" "$PORT" "${WATCH[@]}" >/dev/null 2>&1 &
  disown
  for _ in $(seq 1 50); do ping && break; sleep 0.1; done
fi

if [ -d "$CHROME" ]; then
  open -n -a "$CHROME" --args --app="$URL" --user-data-dir="$PROFILE" --no-first-run --no-default-browser-check
else
  open "$URL"
fi
exit 0
