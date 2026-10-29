#!/bin/sh
# Every 30 minutes from cron: run the small public-data collectors (space weather, outages) in one container.
export PATH="/Volume1/@apps/DockerEngine/dockerd/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO=/Volume2/Media2/docker/watchfloor
CH=/Volume2/Media2/docker/claude-refresh
LOG="$CH/sensors.log"
docker run --rm --network host -v "$REPO":/work -w /work claude-refresh sh -c 'for f in space outages air portwatch; do [ -f server/$f.js ] && node server/$f.js; done; true' >> "$LOG" 2>&1
tail -n 300 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
