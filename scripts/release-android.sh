#!/usr/bin/env bash
#
# Build, sign and upload an Android build to Play internal testing from this
# machine.
#
# The local twin of .github/workflows/android.yml: same web build, same
# `cap sync`, same Gradle tasks, same signature check, and an upload that lands
# on the same track. The one difference is that the keystore is a file you
# already have rather than a base64 secret decoded into a temp file.
#
# Configuration lives in .env.release (gitignored) — see .env.release.example.
#
#   npm run release:android                  # build, then upload to internal testing
#   npm run release:android -- --no-upload   # build the APK and AAB only
#   npm run release:android -- --version 1.2.0 --code 41
#
set -euo pipefail

cd "$(dirname "$0")/.."

PACKAGE="ie.nasouth.bmltsearch"
TRACK="internal"
UPLOAD=1
VERSION_NAME=""
VERSION_CODE=""

# Captured before the loop below consumes them: the `op run` re-exec further down
# has to hand the script its ORIGINAL arguments. Passing "$@" after parsing meant
# passing nothing at all, which silently turned --no-upload into an upload.
ORIGINAL_ARGS=("$@")

while [ $# -gt 0 ]; do
  case "$1" in
    --no-upload) UPLOAD=0 ;;
    --upload) UPLOAD=1 ;;
    --track) TRACK="${2:?--track needs a value}"; shift ;;
    --version) VERSION_NAME="${2:?--version needs a value}"; shift ;;
    --code) VERSION_CODE="${2:?--code needs a value}"; shift ;;
    -h | --help)
      awk 'NR > 1 { if (/^#/) { sub(/^# ?/, ""); print } else { exit } }' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1 (try --help)" >&2
      exit 2
      ;;
  esac
  shift
done

# Secrets may be 1Password references rather than values.
#
# `op run` resolves every op:// reference in the env file, injects the results as
# environment variables and masks them in this script's output, so nothing
# sensitive is ever written to disk or scrollback. Re-running the script through
# it is what makes `npm run release:...` work unchanged either way: with plain
# values in .env.release nothing happens here, and with op:// references the
# script restarts itself under `op run` exactly once.
ENV_FILE=".env.release"
if [ -z "${RELEASE_ENV_INJECTED:-}" ] && [ -f "$ENV_FILE" ] && grep -q 'op://' "$ENV_FILE"; then
  command -v op > /dev/null || {
    echo "error: $ENV_FILE holds op:// references but the 1Password CLI is not installed" >&2
    exit 1
  }
  export RELEASE_ENV_INJECTED=1
  exec op run --env-file="$ENV_FILE" -- "$0" ${ORIGINAL_ARGS[@]+"${ORIGINAL_ARGS[@]}"}
fi

# Skipped when `op run` already injected them: sourcing the file a second time
# would overwrite real secrets with the literal op:// strings.
# shellcheck source=/dev/null
[ -z "${RELEASE_ENV_INJECTED:-}" ] && [ -f "$ENV_FILE" ] && set -a && . "./$ENV_FILE" && set +a

# The Maps keys normally live in .env, which Vite reads on its own. Read them
# here too, so the value handed to Gradle below matches the one baked into the
# web bundle instead of quietly differing — but only when nothing has already
# supplied one, so a key from 1Password is not clobbered by a stale .env.
if [ -z "${GOOGLE_MAPS_KEY_ANDROID:-}${PUBLIC_GOOGLE_MAPS_KEY_ANDROID:-}" ] && [ -f .env ]; then
  # shellcheck source=/dev/null
  set -a && . ./.env && set +a
fi

fail() {
  echo "error: $*" >&2
  exit 1
}

# Not optional, unlike every other key in this project: the Maps SDK for Android
# throws IllegalStateException "API key not found" from its own background thread
# the moment it initialises, which kills the process rather than just the map
# screen. An APK built without it crashes on launch.
MAPS_KEY="${GOOGLE_MAPS_KEY_ANDROID:-${PUBLIC_GOOGLE_MAPS_KEY_ANDROID:-}}"
[ -n "$MAPS_KEY" ] || fail "no Android Maps key. Set GOOGLE_MAPS_KEY_ANDROID in .env.release or PUBLIC_GOOGLE_MAPS_KEY_ANDROID in .env — a build without it crashes on launch."

: "${ANDROID_KEYSTORE_PASSWORD:?set ANDROID_KEYSTORE_PASSWORD in .env.release}"

# Anything that has to reach Gradle or the Play API as a *file* can arrive either
# as a path on disk or as the same base64/JSON blob CI holds in a secret — which
# is what lets one 1Password item feed both this script and `gh secret set`.
# Materialised into a temp directory that goes away on exit, so a secret pulled
# out of 1Password never outlives the build.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -z "${ANDROID_KEYSTORE_PATH:-}" ] && [ -n "${ANDROID_KEYSTORE_BASE64:-}" ]; then
  ANDROID_KEYSTORE_PATH="$WORK/upload-keystore.jks"
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 --decode > "$ANDROID_KEYSTORE_PATH" ||
    fail "ANDROID_KEYSTORE_BASE64 is not valid base64"
fi
: "${ANDROID_KEYSTORE_PATH:?set ANDROID_KEYSTORE_PATH (or ANDROID_KEYSTORE_BASE64) in .env.release}"
[ -f "$ANDROID_KEYSTORE_PATH" ] || fail "no keystore at $ANDROID_KEYSTORE_PATH"

if [ "$UPLOAD" -eq 1 ]; then
  if [ -z "${PLAY_SERVICE_ACCOUNT_JSON_PATH:-}" ] && [ -n "${PLAY_SERVICE_ACCOUNT_JSON:-}" ]; then
    PLAY_SERVICE_ACCOUNT_JSON_PATH="$WORK/play-service-account.json"
    printf '%s' "$PLAY_SERVICE_ACCOUNT_JSON" > "$PLAY_SERVICE_ACCOUNT_JSON_PATH"
  fi
  : "${PLAY_SERVICE_ACCOUNT_JSON_PATH:?set PLAY_SERVICE_ACCOUNT_JSON_PATH (or PLAY_SERVICE_ACCOUNT_JSON) in .env.release, or pass --no-upload}"
  [ -f "$PLAY_SERVICE_ACCOUNT_JSON_PATH" ] || fail "no service account JSON at $PLAY_SERVICE_ACCOUNT_JSON_PATH"
fi

if [ -z "$VERSION_NAME" ]; then
  TAG="$(git describe --exact-match --tags 2>/dev/null || true)"
  # 0.0.0-dev is the Gradle fallback and the workflow's own name for a build that
  # is not a release. Keeping it means an untagged local build cannot be mistaken
  # for one in the Play release list.
  VERSION_NAME="${TAG#v}"
  [ -n "$VERSION_NAME" ] || VERSION_NAME="0.0.0-dev"
fi

# Play permanently refuses a versionCode it has already accepted, and refuses one
# below the highest already uploaded. Ask Play what it holds rather than guess —
# it is the only source that knows about builds CI uploaded from another machine.
if [ -z "$VERSION_CODE" ]; then
  if [ "$UPLOAD" -eq 1 ]; then
    echo "==> Asking Play for the next version code"
    VERSION_CODE="$(node scripts/play-upload.mjs --print-next-code --package "$PACKAGE" --json-key "$PLAY_SERVICE_ACCOUNT_JSON_PATH")" ||
      fail "could not derive a version code — pass one with --code N"
  else
    VERSION_CODE=1
  fi
fi

echo "==> $VERSION_NAME (code $VERSION_CODE)"

echo "==> Building web bundle"
npm run build

echo "==> Syncing Capacitor"
npx cap sync android

# GOOGLE_MAPS_KEY_ANDROID is passed to Gradle separately from the web bundle's
# keys because the Maps SDK for Android reads its key from the merged manifest,
# not from the apiKey handed to GoogleMap.create().
echo "==> Assembling release APK and AAB"
(
  cd android
  ANDROID_KEYSTORE_PATH="$ANDROID_KEYSTORE_PATH" \
    ANDROID_KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD" \
    ANDROID_KEY_ALIAS="${ANDROID_KEY_ALIAS:-upload}" \
    ANDROID_KEY_PASSWORD="${ANDROID_KEY_PASSWORD:-$ANDROID_KEYSTORE_PASSWORD}" \
    GOOGLE_MAPS_KEY_ANDROID="$MAPS_KEY" \
    ANDROID_VERSION_CODE="$VERSION_CODE" \
    ANDROID_VERSION_NAME="$VERSION_NAME" \
    GIT_COMMIT="$(git rev-parse --short=7 HEAD 2>/dev/null || echo unknown)" \
    ./gradlew assembleRelease bundleRelease --no-daemon
)

APK="$(find android/app/build/outputs/apk/release -name '*.apk' | head -1)"
AAB="$(find android/app/build/outputs/bundle/release -name '*.aab' | head -1)"
[ -n "$APK" ] || fail "no APK was produced"
[ -n "$AAB" ] || fail "no AAB was produced"

# An unsigned APK still builds and would upload happily, then fail to install
# with no useful message. The printed certificate is also what has to be
# registered on the Android Maps key, so a blank map traces back to here.
APKSIGNER="$(find "${ANDROID_HOME:-$HOME/Library/Android/sdk}/build-tools" -name apksigner 2>/dev/null | sort -V | tail -1)"
if [ -n "$APKSIGNER" ]; then
  echo "==> Signing certificate"
  "$APKSIGNER" verify --print-certs "$APK" | grep -i 'SHA-1' || fail "the APK is not signed"
else
  echo "warning: apksigner not found — skipping the signature check" >&2
fi

mkdir -p build-artifacts/android
cp "$APK" "$AAB" build-artifacts/android/
echo "==> Wrote build-artifacts/android/$(basename "$APK") and $(basename "$AAB")"

if [ "$UPLOAD" -eq 0 ]; then
  echo "==> --no-upload: stopping before Play"
  exit 0
fi

echo "==> Uploading to Play $TRACK"
node scripts/play-upload.mjs \
  --package "$PACKAGE" \
  --json-key "$PLAY_SERVICE_ACCOUNT_JSON_PATH" \
  --aab "$AAB" \
  --track "$TRACK" \
  --release-name "$VERSION_NAME ($VERSION_CODE)"

# Play re-signs the AAB with its own app signing key, so what testers install
# does NOT carry this keystore's certificate. That key's SHA-1 has to be on the
# Android Maps key too, or the map is blank for everyone who installs from Play
# while working perfectly in the APK above.
echo "==> Uploaded. Note Play re-signs the AAB: the SHA-1 above is not what testers will run."
