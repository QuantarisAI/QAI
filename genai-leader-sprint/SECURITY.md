# Site safety and the off switch

**Short version.** If an attack is detected, the site shows a lock screen instead of running, and the owner can also switch the whole site off from the GitHub Actions tab. This is real, but a static site has limits. They are listed below so you do not trust it more than it deserves.

## What this site is (and why that matters)

It is a static site on GitHub Pages: no server code, no database, no accounts, no passwords, no analytics, nothing sent anywhere. Progress lives in the visitor's own browser. So there is very little to steal, and nothing to break into on a server. The realistic risks are: someone changing the published files (through the repository, the Pages deployment or a CDN), someone injecting script into a visitor's page, or someone embedding the site in another page (clickjacking).

## The layers

| Layer | What it does | Where |
|---|---|---|
| **Content-Security-Policy** | Scripts may only come from this site, plus the exact hashes of Next.js' own inline scripts. No `unsafe-inline` or `unsafe-eval` for scripts. No frames, no form posts, no `<base>`, no objects. Added to every page at build time. | `scripts/harden-export.mjs` |
| **In-page detectors** | Lock the UI when: the browser reports a script, frame, form or base violation; a foreign `<script>`/`<iframe>`/`<object>`/`<form>`/`<base>`/meta-refresh is added to the page; the site is shown inside another site's frame; a loaded script's SHA-256 does not match `integrity.json`. Browser-extension UI is ignored on purpose, so normal users are not locked out. | `src/security/` |
| **Remote kill switch** | `status.json` is fetched on load and every 5 minutes. If it says `"locked"`, every page (NVIDIA and Google) shows the lock screen. | `public/status.json` |
| **Watchdog** (outside the browser) | Every ~15 minutes a GitHub Action fetches the live site and checks every file against `integrity.json`, the CSP on every page, and the page HTML for foreign hosts, injected inline scripts, `<base>`, frames and meta refresh. On a mismatch it runs the lockdown and opens an issue. | `.github/workflows/watchdog.yml`, `scripts/watchdog.ts` |
| **Lockdown workflow** | Replaces the published site with a plain static lock page (no JavaScript), commits `status.json = locked` so rebuilds stay locked, and can optionally unpublish Pages. | `.github/workflows/lockdown.yml` |
| **Unlock workflow** | Marks the site ok and redeploys. `pages.yml` refuses to deploy while the site is locked. | `.github/workflows/unlock.yml` |

## How to switch the site off yourself

GitHub, **Actions** tab, **Lockdown site**, **Run workflow**, enter a reason. The site is replaced within about a minute. Tick *hard_off* to also unpublish Pages (needs admin rights). To bring it back: **Unlock site**, **Run workflow**, after you have checked the repository and recent deployments are clean.

Quick manual alternative: edit `genai-leader-sprint/public/status.json` to `{"status":"locked"}` and redeploy.

## What it cannot do (be honest)

- **No server, so no headers.** GitHub Pages does not let us set HTTP headers. The CSP is a `<meta>` tag, and `frame-ancestors` (the proper anti-clickjacking control) is not available in a meta tag, so the page checks `window.top` instead, which an attacker with script access could bypass.
- **In-page detection can be removed by an attacker who already controls the page's JavaScript.** That is why the lock lever that matters is outside the page (kill switch file, watchdog, lockdown workflow).
- **An attacker who controls the repository or the deployment can change `integrity.json`, the files and the CSP together.** The watchdog compares the live site with itself, so it cannot see that. Protect the repository: see the checklist below. The watchdog catches the more common cases: a file changed after deployment, a bad deploy that skipped hardening, tampering at a CDN or cache layer.
- **It cannot see traffic.** A flood of requests is absorbed by GitHub's CDN; there is nothing to "disable" and no way to detect it from the site. If GitHub's CDN is down, so is the site.
- **The watchdog runs about every 15 minutes** (GitHub may delay scheduled jobs). It is a smoke alarm, not a guard at the door.
- **Fail-open on network errors.** If `status.json` cannot be fetched (offline, blocked), the app keeps running, so a flaky connection cannot lock a learner out of their own study session. A lock needs a positive signal.
- **It does not hide the questions.** The question bank and its answers are shipped to the browser; anyone can read them. This is a self-study tool, not a secure exam.
- **GitHub Actions can be refused permission to push workflow files** from some tokens. If the workflow files are missing from the repository after a push, add them through the GitHub web UI.

## Checklist for the repository owner (this is where real protection lives)

1. Turn on **two-factor authentication** for every account with write access.
2. **Branch protection on `main`**: require pull requests and at least one review; block force-pushes.
3. **Settings, Actions, General**: restrict to *Allow actions created by GitHub* (and verified creators); set workflow permissions to *read* by default (the workflows here ask for what they need explicitly).
4. **Settings, Pages**: set the source to *GitHub Actions* (not a branch) and enforce HTTPS.
5. Turn on **Dependabot alerts**, **secret scanning** and **code scanning**.
6. Keep `package-lock.json` committed; the workflow uses `npm ci`.
7. Optionally set a repository **variable** `SITE_URL` so the watchdog works if Pages' URL lookup is not permitted.

## Testing the lockdown

- Unit tests: `tests/security.test.ts`, `tests/watchdog.test.ts`.
- Browser test (needs a built `out/`): `BASE=http://localhost:3199 node e2e/nvidia.mjs` injects a foreign script and a foreign iframe, flips the kill switch, embeds the site in a frame, and checks that harmless DOM changes do not lock the site.
