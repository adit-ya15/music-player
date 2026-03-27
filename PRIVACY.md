# Privacy Notes

Aura Music is designed to keep the project lightweight and self-hostable. The current codebase does not include user accounts or a hosted analytics pipeline by default, but it does process music metadata and playback-related requests.

## What the App Uses

- Search terms sent to the backend so it can fetch music results
- Track metadata needed for playback, queueing, recommendations, and lyrics lookup
- Local device storage for favorites, recent plays, session restore, and downloaded tracks
- Optional recommendation API protection through `RECO_API_KEY`

## What Stays On Device

- Favorites
- Recently played tracks
- Player session state
- Downloaded audio files and their local metadata
- Theme and autoplay preference settings

## External Services

Depending on the feature used, the backend may reach external music and lyrics sources. These integrations may change over time, so review the current code before shipping a hosted service.

## Self-Hosting Guidance

- Keep cookies exports, API keys, and signing credentials outside the repository.
- Serve the backend over HTTPS.
- Add your own monitoring and retention policy if you collect logs in production.
- Publish a full public-facing privacy policy before distributing the app widely or handling user telemetry.
