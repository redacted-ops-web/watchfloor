#!/bin/sh
# Every 20 minutes: ask smart.js whether the news moved enough to justify a light refresh, and run one if so.
export PATH="/Volume1/@apps/DockerEngine/dockerd/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
REPO=/Volume2/Media2/docker/watchfloor
CH=/Volume2/Media2/docker/claude-refresh
D=$(docker run --rm --network host -v "$CH":/root -v "$REPO":/work -w /work claude-refresh node server/smart.js 2>&1 | tail -1)
echo "$(date) smart: $D" >> "$CH/refresh.log"
case "$D" in run:*) sh "$REPO/server/refresh.sh" light ;; esac
