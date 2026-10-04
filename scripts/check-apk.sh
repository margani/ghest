#!/usr/bin/env bash
# Fail if an APK requests any permission other than AndroidX's app-private receiver guard.
set -euo pipefail
apk="$1"
aapt2="$(ls -d "${ANDROID_HOME:-$HOME/Android/Sdk}"/build-tools/*/ | sort -V | tail -1)aapt2"
perms="$("$aapt2" dump permissions "$apk" | grep '^uses-permission' | grep -v 'DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION' || true)"
if [ -n "$perms" ]; then
  echo "Unexpected permissions in $apk:" >&2
  echo "$perms" >&2
  exit 1
fi
echo "OK: $apk requests no permissions (no INTERNET)."
