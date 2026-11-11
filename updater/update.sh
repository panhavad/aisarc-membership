#!/bin/sh
# Polls the git remote; on new commits: pull, rebuild and restart the app container.
set -u
BRANCH="${GIT_BRANCH:-main}"
INTERVAL="${POLL_INTERVAL:-60}"
PROJECT="${PROJECT:-aisarc}"

git config --global --add safe.directory /repo
cd /repo || exit 1
echo "[updater] watching origin/$BRANCH every ${INTERVAL}s"

while true; do
  if git fetch --quiet origin "$BRANCH"; then
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/$BRANCH")
    if [ "$LOCAL" != "$REMOTE" ]; then
      echo "[updater] $(date -u +%FT%TZ) new commit $REMOTE"
      git reset --hard "origin/$BRANCH"
      if docker compose -p "$PROJECT" -f /repo/docker-compose.yml up -d --build app; then
        docker image prune -f >/dev/null 2>&1
        echo "[updater] deployed $(git log -1 --format='%h %s')"
      else
        echo "[updater] deploy FAILED"
      fi
    fi
  else
    echo "[updater] git fetch failed (check remote / credentials)"
  fi
  sleep "$INTERVAL"
done
