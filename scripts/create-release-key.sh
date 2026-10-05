#!/usr/bin/env bash
# Creates the release signing key and stores it in the repository's GitHub Actions secrets.
#
# Run it once, interactively. It asks for one password: a PKCS12 keystore has a single
# password, so the same value goes into GHEST_KEYSTORE_PASSWORD and GHEST_KEY_PASSWORD.
# Nothing is uploaded unless the keystore was created and opens with that password.
# It refuses to overwrite an existing keystore: replacing a signing key breaks updates
# for everyone who already installed the app.
#
# Overridable: REPO, KEYSTORE, KEYTOOL. For non-interactive use (tests), set GHEST_STORE_PASSWORD.
set -euo pipefail

REPO="${REPO:-margani/ghest}"
KEYSTORE="${KEYSTORE:-$HOME/keys/ghest-release.jks}"
ALIAS=ghest
KEYTOOL="${KEYTOOL:-$(command -v keytool || ls -d "$HOME"/.jdks/jdk-21*/bin/keytool 2>/dev/null | head -1 || true)}"

die() { echo "error: $*" >&2; exit 1; }

[ -n "$KEYTOOL" ] && [ -x "$KEYTOOL" ] || die "keytool not found; set KEYTOOL=/path/to/jdk/bin/keytool"
command -v gh >/dev/null || die "gh (GitHub CLI) not found"
gh auth status >/dev/null 2>&1 || die "gh is not logged in; run: gh auth login"
[ ! -e "$KEYSTORE" ] || die "$KEYSTORE already exists; refusing to overwrite a signing key"

if [ -z "${GHEST_STORE_PASSWORD:-}" ]; then
  read -rsp "New keystore password (at least 6 characters): " p1; echo
  read -rsp "Repeat it: " p2; echo
  [ "$p1" = "$p2" ] || die "the passwords differ"
  GHEST_STORE_PASSWORD="$p1"
fi
[ "${#GHEST_STORE_PASSWORD}" -ge 6 ] || die "keytool needs a password of at least 6 characters"
export GHEST_STORE_PASSWORD

mkdir -p "$(dirname "$KEYSTORE")"
chmod 700 "$(dirname "$KEYSTORE")"

# -dname makes keytool non-interactive. The certificate is embedded in every APK and
# readable by anyone, so it carries the app name rather than a personal name.
"$KEYTOOL" -genkeypair -noprompt \
  -keystore "$KEYSTORE" -storetype PKCS12 -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=Ghest" \
  -storepass:env GHEST_STORE_PASSWORD -keypass:env GHEST_STORE_PASSWORD
chmod 600 "$KEYSTORE"

# Prove the keystore opens with the password before anything leaves this machine.
fingerprint="$("$KEYTOOL" -list -v -keystore "$KEYSTORE" -alias "$ALIAS" -storepass:env GHEST_STORE_PASSWORD \
  | sed -n 's/^[[:space:]]*SHA256: //p')"
[ -n "$fingerprint" ] || die "the new keystore did not open; nothing was uploaded"

base64 -w0 "$KEYSTORE" | gh secret set GHEST_KEYSTORE_B64 -R "$REPO"
printf %s "$GHEST_STORE_PASSWORD" | gh secret set GHEST_KEYSTORE_PASSWORD -R "$REPO"
printf %s "$GHEST_STORE_PASSWORD" | gh secret set GHEST_KEY_PASSWORD -R "$REPO"
printf %s "$ALIAS" | gh secret set GHEST_KEY_ALIAS -R "$REPO"

cat <<EOF

Done. Keystore: $KEYSTORE
Certificate SHA-256: $fingerprint

Back it up now. If the keystore or its password is lost, no update can ever be
published to people who installed from GitHub:
  1. Store the password in your password manager.
  2. Store a copy of $KEYSTORE there too (or on an offline drive).
EOF
