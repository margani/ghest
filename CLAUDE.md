# Ghest — Claude Code instructions

## Project
- Purpose: offline tracker for fixed recurring payments (loans, car finance, tuition): where you are in each one, what's left, and when it ends. Persian/English, Solar Hijri/Gregorian/Lunar Hijri calendars, any currency.
- Ships as: an Android app (GitHub Releases, Obtainium, F-Droid) and a PWA.
- Stack: plain HTML/CSS/JS ES modules in `www/` (no bundler, no framework), wrapped with Capacitor 8 for Android. The PWA is served as Cloudflare Workers static assets (no Worker code, no D1/KV: there is no server-side data).
- Licence: GPL-3.0-only. Only FOSS dependencies (F-Droid).

## Commands
- Install: `npm ci`
- Test: `npm test` (also fails if `www/sw.js` is stale)
- Build web: after any change in `www/`, run `npm run build:sw`, then `npm run sync` and commit the regenerated `android/` files (CI fails if they drift; F-Droid builds from them).
- Build Android: `export JAVA_HOME=~/.jdks/jdk-21.0.12.1+1` then `npm run apk` (debug) or `npm run apk:release` (unsigned without keystore env vars).
- Lint: no JS linter is configured. For the F-Droid recipe: `fdroid lint` and `fdroid rewritemeta` (see `docs/fdroid/`).
- Local dev: `npm run dev` (wrangler dev, http://localhost:8787)

## GitHub workflow
- Owner issues, owner-task handoff, visual-check basics: see the global `~/.claude/CLAUDE.md`.
- Issue first, then a branch from `sandbox` (e.g. `23-show-version`) and a PR into `sandbox` that references the issue. When tests pass and the visual check is clean, merge the PR yourself.
- Owner tasks: issue assigned to `margani`, label `needs-owner`. Commands handed to the owner must be tested first.
- All repo text is English. Persian appears only in the `fa` UI strings and the `fa-IR` store listing.

## Visual testing
- For UI changes, run `npm run dev` (wrangler dev) first, then open the LOCAL url it prints (http://localhost:8787) with Playwright and screenshot it.
- Playwright: `playwright-core` with `executablePath: '/usr/bin/google-chrome'` (kept outside the repo). Check phone size (412×915) and desktop, Persian (RTL) and English, light and dark.
- Native-only behaviour (storage, file picker, share sheet, back gesture): Android emulator AVD `inkla`.
- Do not test visually against production or the remote sandbox; use the local url.
- Screenshots and store images use fictional demo data, never the owner's real loans (`my-loans.local.json` is gitignored and stays local).

## Versioning & deploy
- Version: `versionName`/`versionCode` in `android/app/build.gradle` (single source). Showing it in the app is tracked in #23.
- Branch model:
  - `main` -> PRODUCTION (https://ghest.margani.dev, and Android releases).
  - `sandbox` -> SANDBOX (https://ghest-sandbox.whosane.workers.dev).
- Feature/bug work: branch from `sandbox`, open a PR into `sandbox`, merge there once tests + visual check pass. Collect changes in sandbox.
- The owner tests the full sandbox. When they're happy with all fixes together, open ONE PR from `sandbox` into `main`, listing every bug/feature included and bumping the version.
- Merging that PR releases a clean, versioned production deploy with all fixes at once. NEVER push straight to `main` or deploy production without that PR.
- Android releases: tag `v<versionName>` on `main` after the release PR; `.github/workflows/release.yml` builds, signs and publishes. Tags are production too.
- Builds must stay reproducible (F-Droid compares its build with the GitHub release). Keep `android/` in sync with `www/` and don't add non-deterministic build steps.

## PWA
- Updates install automatically in the background; an Update button appears when a new version is ready (`www/js/pwa.js`, `www/sw.js`). `scripts/build-sw.mjs` stamps `sw.js` with a hash of every file, so any change is a new version.
- Tie the shown version number to the deployed build (#23).

## Environments
- Local dev: `npm run dev` (wrangler dev)
- Sandbox deploy: automatic on every push to `sandbox` (`.github/workflows/deploy.yml`, url: https://ghest-sandbox.whosane.workers.dev). By hand: `npm run deploy:sandbox`.
- Production deploy: automatic on every push to `main`, i.e. the release PR (url: https://ghest.margani.dev). Never by hand; to redeploy the current `main`, re-run its Deploy PWA workflow run.
- No version endpoint yet (#23): verify a deploy by comparing the live `/sw.js` with `www/sw.js` on the branch (it carries a hash of every file).
- The old production address https://ghest.whosane.workers.dev is off (`workers_dev: false` at the top level of `wrangler.jsonc`, 2026-10-09). The sandbox environment sets its own `workers_dev: true`; keep it, it is the sandbox's only address.

## Data safety
- There is no server database. Data lives on the device: SharedPreferences (Android) or browser storage per origin (PWA). The sandbox is a different origin, so it never sees production data.
- The release keystore is `~/keys/ghest-release.jks` (local only, never committed); signing values live in GitHub secrets.

## F-Droid
- Merge request: https://gitlab.com/fdroid/fdroiddata/-/merge_requests/51279. Recipe copy: `docs/fdroid/dev.margani.ghest.yml` (pinned to a full commit hash; reproducible build with `Binaries` + `AllowedAPKSigningKeys`).
- Until it is merged, new features wait in the "After F-Droid release" milestone; problems are filed as issues.
- Keep reviewer replies short.

## Open tasks
- Owner: #2 test on your phone, #7 review the Persian copy.
- F-Droid review: #4 (1.0.7 recipe green and reproducible; waiting for an on-device test).
- After F-Droid release: #15 theme setting, #23 show the version.
