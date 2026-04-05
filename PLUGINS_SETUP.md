# Nuclear Plugin Setup (Null)

This document lists exactly what to configure so each imported Nuclear plugin can run.

## Core Goal

- Keep playback fast and avoid backend overload.
- Resolve streams from the client whenever possible.
- Use provider fallbacks without conflicts.

## Required by Plugin

### 1) YouTube (streaming)
- Env: `VITE_YTDLP_ENDPOINTS`
- Format: comma-separated endpoint list
- Example:
  - `VITE_YTDLP_ENDPOINTS=https://edge1.example/stream/{videoId},https://edge2.example/stream/{videoId}`

### 2) Monochrome (streaming)
- Env (optional override): `VITE_MONOCHROME_ENDPOINTS`
- If not set, built-in public endpoints are used.

### 3) SoundCloud (streaming)
- Env: `VITE_SOUNDCLOUD_CLIENT_ID`

### 4) Discogs (metadata)
- Env: `VITE_DISCOGS_TOKEN`

### 5) MusicBrainz (metadata)
- No secret required (public API).

### 6) Spotify metadata plugin
- **OPTIONAL** — requires paid API plan (free tier is limited)
- Plugin gracefully degrades when credentials are missing
- If you have a paid Spotify Developer plan, add to backend .env:
  - `SPOTIFY_CLIENT_ID`
  - `SPOTIFY_CLIENT_SECRET`
- Metadata fallback via MusicBrainz/Discogs still works without Spotify

### 7) Deezer Dashboard
- No secret required (public API usage).

### 8) ListenBrainz Dashboard
- No secret required (public API usage).

### 9) Last.fm scrobbling
- Client endpoint (default): `/api/plugins/lastfm`
- Backend env required:
  - `LASTFM_API_KEY`
  - `LASTFM_API_SECRET`
  - `LASTFM_SESSION_KEY`

### 10) YouTube Playlists Import
- Client endpoint (default): `/api/plugins/youtube-playlist`
- Uses server yt-dlp for flat playlist extraction.

### 11) Bandcamp plugin
- Env: `VITE_BANDCAMP_SEARCH_ENDPOINT`
- Optional plugin adapter endpoint for search/metadata.

## Recommended Frontend .env example

```env
VITE_YTDLP_ENDPOINTS=https://edge1.example/stream/{videoId},https://edge2.example/stream/{videoId}
VITE_MONOCHROME_ENDPOINTS=https://monochrome-api.samidy.com,https://api.monochrome.tf
VITE_SOUNDCLOUD_CLIENT_ID=your_soundcloud_client_id
VITE_DISCOGS_TOKEN=your_discogs_token
VITE_BANDCAMP_SEARCH_ENDPOINT=https://your-domain.example/api/bandcamp

# Optional overrides (defaults are built in)
# VITE_SPOTIFY_METADATA_ENDPOINT=/api/plugins/spotify-metadata
# VITE_LASTFM_PROXY_ENDPOINT=/api/plugins/lastfm
# VITE_YOUTUBE_PLAYLIST_IMPORT_ENDPOINT=/api/plugins/youtube-playlist
```

## Required Backend .env example

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
LASTFM_API_KEY=your_lastfm_api_key
LASTFM_API_SECRET=your_lastfm_api_secret
LASTFM_SESSION_KEY=your_lastfm_session_key
```

## Collaboration Rules (No Conflict)

- YouTube plugin and Monochrome plugin run in hedged mode for low latency.
- Jamendo is retained as legal fallback.
- Metadata plugins only enrich track details and do not alter resolver priority.
- Dashboard plugins only contribute feed sections and do not change playback pipeline.
- Scrobbling runs from playback hooks and is isolated from stream resolution.

## Verification Checklist

1. Open Settings -> First-Run Readiness.
2. Open Settings -> Nuclear Plugin Pack.
3. Ensure enabled plugins show `ready` or expected `degraded` with missing env keys listed.
4. Test search + play for YouTube/SoundCloud/Jamendo.
5. Test YouTube URL playlist import in Library -> Playlists.
6. Confirm Last.fm proxy receives now-playing updates.

## Server Load Protection Notes

- End users do not need local yt-dlp.
- Stream resolution is client-first.
- Keep yt-dlp endpoints horizontally scalable and rate-limited.
- Avoid routing all stream resolution through a single backend instance.
