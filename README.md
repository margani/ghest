# Ghest · قسط

An offline Android app for fixed recurring payments (loans, car finance, tuition, mahr) that shows where you are in each one and when it ends.

- Persian and English UI, with RTL and LTR layouts and the matching digits.
- Payment schedules in the Solar Hijri, Gregorian or Lunar Hijri calendar. Dates can be displayed in any of the three.
- Any ISO 4217 currency, plus toman. Each commitment can use its own currency, and totals are shown per currency.
- A lump-sum calculator shows how much interest an extra payment saves on each commitment and how many months it cuts.
- **No internet permission.** No analytics, no crash reporting, no remote fonts. Your data never leaves the phone.

## What it computes

Each commitment has an amount per payment, a frequency (daily, weekly, monthly or yearly), a payment day, a total number of payments, and an optional APR.

- **Payment dates** are derived from the first payment and an index, never stepped from the previous one. A payment on the 31st falls on the last day of shorter months, then goes back to the 31st (31 Jan → 28 Feb → 31 Mar). The same applies to 30 Esfand and to 29/30-day lunar months.
- **A payment on today's date counts as made.**
- **APR** is read as an effective annual rate (the UK definition). The periodic rate is `(1 + APR)^(1/n) − 1`, with n = 365, 52, 12 or 1 depending on frequency.
- **Remaining principal** is the present value of the remaining payments. Remaining interest is the remaining payments minus that principal. Your lender's settlement figure may differ slightly.
- **Lunar Hijri** uses the Umm al-Qura tables built into Android's ICU. Iran's official lunar calendar is set by moon sighting and can differ by a day; no offline source can predict that.

## Backup

Data is stored in SharedPreferences, through `@capacitor/preferences`. It survives clearing the WebView cache, but not uninstalling the app or clearing its storage. Android cloud backup is disabled on purpose.

**Settings → Export** writes a JSON file and opens the share sheet. **Import** replaces all data with the contents of a backup file.

## Development

```sh
npm install
npm test                 # date and amortisation maths, import validation, formatting
npx serve www            # or any static server; the browser build uses localStorage
```

The source is plain ES modules in `www/`, with no bundler and no framework:

| File | Contents |
|---|---|
| `js/calendars.js` | Gregorian, Solar Hijri (vendored `jalaali-js`) and Lunar Hijri (Intl) calendars, using integer day numbers |
| `js/schedule.js` | Payment dates, payments made, amortisation, lump sum. Pure functions. |
| `js/i18n.js` | Strings and Intl-based formatting |
| `js/store.js` | Persistence, export and import, backup validation |
| `js/app.js` | UI |

## Building the APK

This needs JDK 21 (Gradle 8.14 does not run on JDK 25) and the Android SDK.

```sh
export JAVA_HOME=/path/to/jdk-21
npm run apk              # cap sync android && ./gradlew assembleDebug
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

To confirm the APK requests no network access:

```sh
aapt2 dump permissions android/app/build/outputs/apk/debug/app-debug.apk
```

## Releasing

1. Bump `versionCode` and `versionName` in `android/app/build.gradle`, and add `fastlane/metadata/android/{en-US,fa-IR}/changelogs/<versionCode>.txt`.
2. Tag `v<versionName>` and push the tag. The release workflow runs the tests, builds a signed APK, checks that it requests no permissions, and publishes it to GitHub Releases with its SHA-256.

The workflow needs four repository secrets: `GHEST_KEYSTORE_B64` (the keystore, base64-encoded), `GHEST_KEYSTORE_PASSWORD`, `GHEST_KEY_ALIAS` and `GHEST_KEY_PASSWORD`.

For a local signed build, put the same values in `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`). The file is gitignored. Without it, `npm run apk:release` produces an unsigned APK, which is what F-Droid builds and signs itself.

Store listing text and screenshots are in `fastlane/metadata/android/`. A draft F-Droid recipe is in `docs/fdroid/`.

## Licence

GPL-3.0-only. The bundled Vazirmatn font is under the SIL Open Font License 1.1 (`www/fonts/OFL.txt`). `jalaali-js` is under the MIT licence (`www/js/vendor/jalaali.LICENSE`).
