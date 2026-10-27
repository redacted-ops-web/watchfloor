#!/usr/bin/env bash
# Keeps /srv/watchfloor in sync with the GitHub repo. Run from cron every 5 minutes.
# Anything you change by hand inside /srv/watchfloor is overwritten. Edit the repo instead.
set -euo pipefail

DIR=/srv/watchfloor
REPO=https://github.com/redacted-ops-web/watchfloor.git
BRANCH=main

if [ ! -d "$DIR/.git" ]; then
  git clone --depth 1 --branch "$BRANCH" "$REPO" "$DIR"
else
  git -C "$DIR" fetch --quiet --depth 1 origin "$BRANCH"
  git -C "$DIR" reset --quiet --hard "origin/$BRANCH"
fi
