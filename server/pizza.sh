#!/bin/sh
# Every 10 minutes from cron: collect the Pentagon Pizza Index data (see server/pizza.js).
export PATH="/Volume1/@apps/DockerEngine/dockerd/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO=/Volume2/Media2/docker/watchfloor
CH=/Volume2/Media2/docker/claude-refresh
LOG="$CH/pizza.log"
docker run --rm --network host -v "$REPO":/work -w /work claude-refresh node server/pizza.js >> "$LOG" 2>&1
# keep the log short
tail -n 300 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
