#!/bin/sh
# Nightly backup of the Watchfloor data (live data, history, pizza readings) and the refresh logs. Keeps 14 days.
SRC=/Volume2/Media2/docker/watchfloor
CH=/Volume2/Media2/docker/claude-refresh
DEST=/Volume2/Media2/backups/watchfloor
mkdir -p "$DEST"
STAMP=$(date +%Y%m%d)
tar czf "$DEST/watchfloor-$STAMP.tgz" -C "$SRC" data server/refresh-full.txt server/refresh-light.txt -C "$CH" refresh.log last-full.txt last-light.txt 2>/dev/null
find "$DEST" -name 'watchfloor-*.tgz' -mtime +14 -delete
echo "$(date) backup written: watchfloor-$STAMP.tgz" >> "$CH/refresh.log"
