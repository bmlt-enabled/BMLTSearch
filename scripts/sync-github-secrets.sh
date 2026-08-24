#!/usr/bin/env bash
#
# Push the release secrets from 1Password into this repo's GitHub Actions
# secrets, so 1Password stays the single source of truth for both local
# `npm run release:*` builds and CI.
#
#   ./scripts/sync-github-secrets.sh            # push all
#   ./scripts/sync-github-secrets.sh --dry-run  # show names + lengths only
#
# Reads op:// references from .env.release via `op run`, so nothing secret is
# ever written to disk. Maps keys are NOT handled here — they live in .env / the
# GOOGLE_MAPS_* secrets and are managed separately.
set -euo pipefail
cd "$(dirname "$0")/.."

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

# The GitHub secret names, which match the env var names in .env.release.
SECRETS=(
  APPLE_TEAM_ID APPSTORE_KEY_ID APPSTORE_ISSUER_ID APPSTORE_PRIVATE_KEY
  IOS_DIST_CERT_P12_BASE64 IOS_DIST_CERT_PASSWORD
  ANDROID_KEYSTORE_BASE64 ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS
  ANDROID_KEY_PASSWORD PLAY_SERVICE_ACCOUNT_JSON
)

run() {
  for name in "${SECRETS[@]}"; do
    val="${!name:-}"
    if [ -z "$val" ]; then
      echo "  skip  $name (empty — not in .env.release?)" >&2
      continue
    fi
    if [ "$DRY" -eq 1 ]; then
      printf '  would set %-28s (%d chars)\n' "$name" "${#val}"
    else
      printf '%s' "$val" | gh secret set "$name"
      printf '  set   %s\n' "$name"
    fi
  done
}
export -f run
export DRY
export SECRETS_STR="${SECRETS[*]}"

# Re-declare the array inside the op-run subshell (arrays don't cross export).
op run --env-file=.env.release -- bash -c '
  read -ra SECRETS <<< "$SECRETS_STR"
  '"$(declare -f run)"'
  run
'
