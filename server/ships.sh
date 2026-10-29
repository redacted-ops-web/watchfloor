#!/bin/sh
# Every 30 min from cron: count ships via AISstream (see server/ships.js). Needs the key file claude-refresh/ais.key; skips quietly without it.
export PATH="/Volume1/@apps/DockerEngine/dockerd/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO=/Volume2/Media2/docker/watchfloor
CH=/Volume2/Media2/docker/claude-refresh
LOG="$CH/ships.log"
[ -s "$CH/ais.key" ] || exit 0
docker run --rm --network host -e AISSTREAM_KEY="$(cat "$CH/ais.key")" -v "$REPO":/work -w /work claude-refresh node server/ships.js >> "$LOG" 2>&1
tail -n 200 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
