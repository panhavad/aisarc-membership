#!/bin/sh
# Polls the git remote; on new commits: pull, rebuild and restart the app container.
#
# Private repositories (HTTPS): set GIT_USERNAME and GIT_TOKEN (a read-only personal access
# token / deploy token). Optionally set GIT_REPO_URL to the HTTPS clone URL to use.
# The token is supplied through a credential helper from the environment and is never
# written to the repository config, remote URL or logs.
set -u
BRANCH="${GIT_BRANCH:-main}"
INTERVAL="${POLL_INTERVAL:-60}"
PROJECT="${PROJECT:-aisarc}"

git config --global --add safe.directory /repo
cd /repo || exit 1

if [ -n "${GIT_REPO_URL:-}" ]; then
  git remote set-url origin "$GIT_REPO_URL" 2>/dev/null || git remote add origin "$GIT_REPO_URL"
fi

git_auth() {
  if [ -n "${GIT_TOKEN:-}" ]; then
    git -c credential.helper= \
        -c credential.helper='!f() { echo "username=${GIT_USERNAME:-git}"; echo "password=${GIT_TOKEN}"; }; f' "$@"
  else
    git "$@"
  fi
}

# Keep files owned by whoever owns the checkout on the host (the updater runs as root).
OWNER=$(stat -c '%u:%g' /repo)

echo "[updater] watching $(git remote get-url origin) ($BRANCH) every ${INTERVAL}s$([ -n "${GIT_TOKEN:-}" ] && echo ' with token auth')"

while true; do
  if git_auth fetch --quiet origin "$BRANCH"; then
    LOCAL=$(git rev-parse HEAD)
    REMOTE=$(git rev-parse "origin/$BRANCH")
    if [ "$LOCAL" != "$REMOTE" ]; then
      echo "[updater] $(date -u +%FT%TZ) new commit $REMOTE"
      git reset --hard "origin/$BRANCH"
      chown -R "$OWNER" /repo 2>/dev/null
      if docker compose -p "$PROJECT" -f /repo/docker-compose.yml up -d --build app; then
        docker image prune -f >/dev/null 2>&1
        echo "[updater] deployed $(git log -1 --format='%h %s')"
      else
        echo "[updater] deploy FAILED"
      fi
    fi
  else
    echo "[updater] git fetch failed (check GIT_REPO_URL / GIT_USERNAME / GIT_TOKEN or SSH key)"
  fi
  sleep "$INTERVAL"
done
