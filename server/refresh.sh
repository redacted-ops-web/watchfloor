#!/bin/sh
# Runs an INTSUM data refresh with Claude Code inside Docker. Usage: refresh.sh full|light
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
# one rotating region per day for the light refresh to cover (read by the prompt from data/region-of-day.txt)
case "$(date -u +%u)" in
  1) R="Taiwan Strait and the Korean peninsula" ;;
  2) R="India-Pakistan, Afghanistan and Myanmar" ;;
  3) R="Sudan, the Sahel and the Horn of Africa" ;;
  4) R="DR Congo, Ethiopia-Eritrea and Somalia" ;;
  5) R="Venezuela, Haiti and Latin America security" ;;
  6) R="the Balkans, the Caucasus and the Arctic" ;;
  *) R="the South China Sea and the Philippines" ;;
esac
echo "$R" > "$REPO/data/region-of-day.txt"
echo "$(date) $MODE start" >> "$LOG"
docker run --rm -v "$CH":/root -v "$REPO":/work -w /work claude-refresh sh -c "
  rm -f data/live.new.json data/patch.json
  claude -p \"\$(cat server/refresh-$MODE.txt)\" --model claude-sonnet-5-5 --max-turns 80 --allowedTools WebSearch WebFetch Read Write > /root/last-$MODE.txt 2>&1
  if [ $MODE = light ]; then if [ -f data/live.json ]; then BASE=data/live.json; else BASE=data/data.json; fi; node server/apply-patch.js \$BASE data/patch.json data/live.new.json >> /root/refresh.log 2>&1; fi
  node server/validate.js data/live.new.json $MODE >> /root/refresh.log 2>&1 && mv data/live.new.json data/live.json && echo \"\$(date) $MODE published\" >> /root/refresh.log && node server/history.js data/live.json data/history.json $MODE >> /root/refresh.log 2>&1
" >> "$LOG" 2>&1
echo "$(date) $MODE end" >> "$LOG"
rm -rf "$LOCK"
