# Product

<!-- impeccable:product-schema 1 -->

> Written from the repository on 2026-11-01; the owner confirmed the inferred facts the same day.

## Platform

web

One web UI (`www/`) ships two ways: as a PWA and wrapped with Capacitor as an Android app. The Android build is a WebView around the same pages, so the design language is web, not Material.

## Users

- People paying off several fixed commitments at once (bank loans, car finance, tuition, mahr, a phone on instalments) who want to know where they stand without a bank login. Source: README, store listing.
- Primarily Persian speakers, many in Iran, who think in toman and Solar Hijri dates; English and Gregorian are first-class too. Persian is listed first in the UI languages and the store listing has a `fa-IR` locale; toman is a built-in currency.
- The typical moment: checking on a phone what is left, when the next payment falls, and when everything ends; less often, deciding where an extra lump sum should go.

## Product Purpose

Show, for each fixed recurring payment, where you are in it, what is left (including interest, as banks show it), and when it ends; and across all of them, the monthly load, the total left, and the date everything is paid off. Source: README, `CLAUDE.md` domain conventions (#73).

Success: the numbers match what the bank says closely enough to trust, and the answer is visible at a glance.

## Positioning

- Fully offline and private: the Android app has no internet permission; no accounts, analytics, crash reporting or remote fonts. Data never leaves the device. Source: README, `AndroidManifest.xml`.
- Built for Iranian calendars and money as a first-class case, not a locale toggle: Solar Hijri, Gregorian and Lunar Hijri schedules, month-end rules (31st, 30 Esfand, 29/30-day lunar months), toman. Source: README.
- Free software (GPL-3.0-only) on F-Droid with reproducible builds. Source: README, `LICENSE`.

## Operating Context

- Installed from F-Droid, GitHub Releases/Obtainium, or as a PWA from https://ghest.margani.dev.
- Data lives on the device; backup is a JSON file the user exports to the share sheet and imports on another device, replacing all data. Android cloud backup is disabled on purpose. Source: README.
- Updates: the PWA updates in the background and offers an Update button; the Android app is updated by F-Droid or Obtainium. Source: README.

## Capabilities and Constraints

- Commitments: amount per payment, frequency (daily, weekly, monthly, yearly), payment day, number of payments, optional APR (effective annual rate), own currency and own calendar. Extra repayments, early payoff amount, lump-sum calculator. Source: README, `www/js/schedule.js`.
- A commitment's own dates are shown in its own calendar; the Settings calendar is only the default for new commitments (#83).
- "Left" amounts include interest; principal and interest are a breakdown (#73).
- No server, no sync, no accounts. Only FOSS dependencies (F-Droid). Plain HTML/CSS/JS, no framework or bundler. Source: `CLAUDE.md`.
- Persian (RTL) and English (LTR) with matching digits; mixed-direction text on one line must read correctly. Source: README, `CLAUDE.md`.

## Brand Commitments

- Name: "Ghest" in English, «قسط» in Persian. App ID `dev.margani.ghest`. Icon: `assets/icon.svg`. Source: repository.
- Bundled font: Vazirmatn (`www/fonts/`), no remote fonts. Source: `www/`, README.
- Voice: short, plain, everyday Persian in the UI (e.g. «این فایل پشتیبان قسط نیست یا خرابه.»).

## Evidence on Hand

- Store screenshots in `fastlane/metadata/android/*/images/phoneScreenshots/` use fictional demo data. Real loans (`my-loans.local.json`) are private and must never appear in screenshots or docs. Source: `CLAUDE.md`.
- No testimonials, user counts, reviews or press exist in the repository; none may be invented.

## Product Principles

1. Private by construction: anything that needs a network, an account or a tracker is out.
2. Numbers the user can check against their bank: amounts include interest, dates follow the commitment's own calendar.
3. Persian and Iranian calendars are the primary case, not a translation.
4. Never lose data: a stored or imported document that fails validation must not wipe what the user has.
5. One glance answers "how much is left and when does it end".

## Accessibility & Inclusion

- RTL and LTR layouts, Persian and Latin digits, light and dark themes following the device or a manual choice. Source: README, `CLAUDE.md` (#15).
- No formal accessibility standard has been set.
