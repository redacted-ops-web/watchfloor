#!/bin/sh
# Daily from cron: refresh the Flock camera layer from OpenStreetMap (see server/flock.js).
export PATH="/Volume1/@apps/DockerEngine/dockerd/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO=/Volume2/Media2/docker/watchfloor
CH=/Volume2/Media2/docker/claude-refresh
LOG="$CH/flock.log"
docker run --rm --network host -v "$REPO":/work -w /work claude-refresh node server/flock.js >> "$LOG" 2>&1
tail -n 100 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
