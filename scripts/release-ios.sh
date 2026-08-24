#!/usr/bin/env bash
#
# Build, sign and upload an iOS build to TestFlight from this machine.
#
# The local twin of .github/workflows/ios-testflight.yml. Same project, same
# scheme, same archive and export commands, same altool upload — so a build made
# here is the same build CI would have made, and a failure here is reproducible
# there.
#
# Two deliberate differences from CI:
#
#   1. No throwaway keychain. CI imports a .p12 into one because a fresh runner
#      has no identities at all; your login keychain already holds the Apple
#      Distribution certificate, and creating a second keychain here would hide
#      it rather than help.
#   2. The App Store Connect key is read from a file you already have rather
#      than from an inline PEM in a secret.
#
# Configuration lives in .env.release (gitignored) — see .env.release.example.
#
#   npm run release:ios                     # build, then upload to TestFlight
#   npm run release:ios -- --no-upload      # archive and export only
#   npm run release:ios -- --version 1.2.0 --build 41
#
set -euo pipefail

cd "$(dirname "$0")/.."

SCHEME="App"
# SPM-based Capacitor project: there is no .xcworkspace, and passing one fails
# with "does not exist" before any build starts.
XCODE_PROJECT="ios/App/App.xcodeproj"
BUNDLE_ID="ie.nasouth.bmltsearch"

UPLOAD=1
MARKETING_VERSION=""
BUILD_NUMBER=""

# Captured before the loop below consumes them: the `op run` re-exec further down
# has to hand the script its ORIGINAL arguments. Passing "$@" after parsing meant
# passing nothing at all, which silently turned --no-upload into an upload.
ORIGINAL_ARGS=("$@")

while [ $# -gt 0 ]; do
  case "$1" in
    --no-upload) UPLOAD=0 ;;
    --upload) UPLOAD=1 ;;
    --version) MARKETING_VERSION="${2:?--version needs a value}"; shift ;;
    --build) BUILD_NUMBER="${2:?--build needs a value}"; shift ;;
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

fail() {
  echo "error: $*" >&2
  exit 1
}

: "${APPLE_TEAM_ID:?set APPLE_TEAM_ID in .env.release}"
: "${APPSTORE_KEY_ID:?set APPSTORE_KEY_ID in .env.release}"
: "${APPSTORE_ISSUER_ID:?set APPSTORE_ISSUER_ID in .env.release}"

# The key may be a path (how you keep it locally) or an inline PEM (how CI holds
# it). Normalise to a file either way.
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
KEY_FILE="$WORK/AuthKey.p8"
if [ -n "${APPSTORE_PRIVATE_KEY_PATH:-}" ]; then
  [ -f "$APPSTORE_PRIVATE_KEY_PATH" ] || fail "APPSTORE_PRIVATE_KEY_PATH points at no such file: $APPSTORE_PRIVATE_KEY_PATH"
  cp "$APPSTORE_PRIVATE_KEY_PATH" "$KEY_FILE"
elif [ -n "${APPSTORE_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$APPSTORE_PRIVATE_KEY" > "$KEY_FILE"
else
  fail "set APPSTORE_PRIVATE_KEY_PATH (or APPSTORE_PRIVATE_KEY) in .env.release"
fi

# App Store Connect rejects uploads built against anything below the iOS 26 SDK
# with a 409 at the altool stage — after a full successful archive and export.
# Checking here costs a second instead of ten minutes.
SDK_VERSION="$(xcrun --sdk iphoneos --show-sdk-version)"
[ "${SDK_VERSION%%.*}" -ge 26 ] || fail "iOS SDK $SDK_VERSION is below the iOS 26 minimum App Store Connect requires. Update Xcode."

# A tag names a version; anything else leaves the project's own value alone,
# exactly as the workflow does.
if [ -z "$MARKETING_VERSION" ]; then
  TAG="$(git describe --exact-match --tags 2>/dev/null || true)"
  [ -n "$TAG" ] && MARKETING_VERSION="${TAG#v}"
fi

# Build numbers are permanent: App Store Connect refuses one it has already seen
# and refuses one lower than the highest for that version. Rather than guess, ask
# it what it already has. --build overrides for the case where you know better.
if [ -z "$BUILD_NUMBER" ]; then
  echo "==> Asking App Store Connect for the next build number"
  BUILD_NUMBER="$(
    APPSTORE_KEY_ID="$APPSTORE_KEY_ID" \
      APPSTORE_ISSUER_ID="$APPSTORE_ISSUER_ID" \
      APPSTORE_PRIVATE_KEY_PATH="$KEY_FILE" \
      node scripts/asc-next-build.mjs --bundle-id "$BUNDLE_ID" ${MARKETING_VERSION:+--version "$MARKETING_VERSION"}
  )" || fail "could not derive a build number — pass one with --build N"
fi

echo "==> ${MARKETING_VERSION:-(project version)} build $BUILD_NUMBER"

echo "==> Building web bundle"
npm run build

echo "==> Syncing Capacitor"
npx cap sync ios

# altool only looks in these well-known directories for the key; xcodebuild takes
# an explicit path. A key already installed here is left alone.
mkdir -p ~/.appstoreconnect/private_keys
INSTALLED_KEY="$HOME/.appstoreconnect/private_keys/AuthKey_${APPSTORE_KEY_ID}.p8"
KEY_WAS_INSTALLED=1
if [ ! -f "$INSTALLED_KEY" ]; then
  KEY_WAS_INSTALLED=0
  cp "$KEY_FILE" "$INSTALLED_KEY"
  trap 'rm -rf "$WORK"; rm -f "$INSTALLED_KEY"' EXIT
fi

# Signing is left entirely to automatic provisioning — no CODE_SIGN_IDENTITY
# override. It would contradict CODE_SIGN_STYLE=Automatic, and command-line build
# settings apply to every target in the graph, including SPM dependencies like
# GoogleMaps, which then fail with their own provisioning conflict.
echo "==> Archiving"
xcodebuild archive \
  -project "$XCODE_PROJECT" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$WORK/App.xcarchive" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_FILE" \
  -authenticationKeyID "$APPSTORE_KEY_ID" \
  -authenticationKeyIssuerID "$APPSTORE_ISSUER_ID" \
  DEVELOPMENT_TEAM="$APPLE_TEAM_ID" \
  CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  GIT_COMMIT="$(git rev-parse --short=7 HEAD 2>/dev/null || echo unknown)" \
  ${MARKETING_VERSION:+MARKETING_VERSION="$MARKETING_VERSION"} \
  CODE_SIGN_STYLE=Automatic

# ExportOptions.plist ships without a teamID so the repository carries no Apple
# account identifier. CI edits the file in place; here it is copied first, so a
# release never leaves the working tree dirty.
EXPORT_PLIST="$WORK/ExportOptions.plist"
cp ios/App/ExportOptions.plist "$EXPORT_PLIST"
/usr/libexec/PlistBuddy -c "Add :teamID string $APPLE_TEAM_ID" "$EXPORT_PLIST"

echo "==> Exporting IPA"
xcodebuild -exportArchive \
  -archivePath "$WORK/App.xcarchive" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -exportPath "$WORK/export" \
  -allowProvisioningUpdates \
  -authenticationKeyPath "$KEY_FILE" \
  -authenticationKeyID "$APPSTORE_KEY_ID" \
  -authenticationKeyIssuerID "$APPSTORE_ISSUER_ID"

IPA="$(find "$WORK/export" -maxdepth 1 -name '*.ipa' | head -1)"
[ -n "$IPA" ] || fail "no .ipa was produced"

# Kept out of the temp directory the trap deletes: a build worth uploading is a
# build worth still having on disk afterwards.
mkdir -p build-artifacts/ios
cp "$IPA" build-artifacts/ios/
rsync -a --include='*/' --include='*.dSYM/**' --exclude='*' "$WORK/App.xcarchive/dSYMs/" build-artifacts/ios/dSYMs/ 2>/dev/null || true
echo "==> Wrote build-artifacts/ios/$(basename "$IPA")"

if [ "$UPLOAD" -eq 0 ]; then
  echo "==> --no-upload: stopping before TestFlight"
  exit 0
fi

echo "==> Uploading to TestFlight"
xcrun altool --upload-app \
  --type ios \
  --file "$IPA" \
  --apiKey "$APPSTORE_KEY_ID" \
  --apiIssuer "$APPSTORE_ISSUER_ID"

echo "==> Uploaded build $BUILD_NUMBER. Processing takes a few minutes before it appears in TestFlight."
[ "$KEY_WAS_INSTALLED" -eq 1 ] || echo "    (the API key copied to ~/.appstoreconnect/private_keys was removed again)"
