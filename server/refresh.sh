#!/bin/sh
# Runs a Watchfloor data refresh with Claude Code inside Docker. Usage: refresh.sh full|light
# Writes data/live.json in the site folder (untracked, so the git pull cron never overwrites it).
# cron has a bare PATH, so add the Synology Docker location
export PATH="/Volume1/@apps/DockerEngine/dockerd/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
MODE="${1:-light}"
REPO=/Volume2/Media2/docker/watchfloor
CH=/Volume2/Media2/docker/claude-refresh
LOG="$CH/refresh.log"
LOCK="$CH/lock.d"
# skip if a run is already going (a lock older than 90 minutes counts as stale)
if [ -d "$LOCK" ] && [ -z "$(find "$LOCK" -maxdepth 0 -mmin +90 2>/dev/null)" ]; then
  echo "$(date) $MODE skipped, another run is active" >> "$LOG"; exit 0
fi
rm -rf "$LOCK"; mkdir "$LOCK"
echo "$(date) $MODE start" >> "$LOG"
docker run --rm -v "$CH":/root -v "$REPO":/work -w /work claude-refresh sh -c "
  rm -f data/live.new.json
  claude -p \"\$(cat server/refresh-$MODE.txt)\" --model claude-sonnet-5-5 --max-turns 80 --allowedTools WebSearch WebFetch Read Write > /root/last-$MODE.txt 2>&1
  node server/validate.js data/live.new.json $MODE >> /root/refresh.log 2>&1 && mv data/live.new.json data/live.json && echo \"\$(date) $MODE published\" >> /root/refresh.log
" >> "$LOG" 2>&1
echo "$(date) $MODE end" >> "$LOG"
rm -rf "$LOCK"
