# Open Source Release Checklist

Use this before publishing Aura Music publicly or distributing builds from the repo.

## Repo Hygiene

- Run a secrets scan against the full Git history, not only the current working tree.
- Confirm cookies files, API keys, signing materials, and local caches are not tracked.
- Remove any fresh debug artifacts before tagging a release.

## App Hardening

- Set `RECO_API_KEY` in production and protect recommendation endpoints.
- Put the backend behind HTTPS and configure `TRUST_PROXY`.
- Add Redis for cache durability across restarts.
- Add monitoring or structured error reporting for both the backend and Android app.
- Test real-device behavior for weak network, offline playback, queue advance, and resumed playback.

## Release Engineering

- Make sure CI is green for lint, test, build, and Android debug assemble.
- Create and verify a signed Android release build outside the repo.
- Keep a changelog and tag releases consistently.
- Smoke-test search, playback, downloads, lyrics, recommendations, and widget behavior before each release.

## Public Project Readiness

- Keep the README, roadmap, privacy notes, and setup docs up to date.
- Add current screenshots or short demo recordings for the repo page.
- Document deployment steps for the backend and any external dependencies.
- Clarify feature availability by platform whenever Android-only behavior is involved.
