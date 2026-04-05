# yt-dlp Failure & Monochrome Fallback Analysis

## 🔴 ISSUES FOUND & FIXED

### Issue 1: Monochrome Fallback Not Working (FIXED)
**Status**: ✅ RESOLVED

**Root Cause**:
- [PlayerContext.jsx](src/context/PlayerContext.jsx#L362) was not passing `monochromeResolver` to `createMusicSources()`
- Function expected parameter but received `undefined`
- Fallback logic in [musicSources.js line 67](src/sources/musicSources.js#L67) & [line 120](src/sources/musicSources.js#L120) had guard: `if (!monochromeResolver) return null;`

**Fix Applied**:
1. Added import: `import { resolveMonochromeStream } from "../sources/monochromeSource";`
2. Updated initialization: `createMusicSources({ youtubeApi, jamendoApi, soundcloudApi, monochromeResolver: resolveMonochromeStream })`

**Result**: Monochrome will now be used as fallback when yt-dlp fails.

---

## 🔍 Why yt-dlp Fails - Common Causes

### 1. **Non-Retryable Errors** (Logged & Skipped)
These fail permanently without fallback to other providers:
- ❌ "sign in to confirm" - Account login required
- ❌ "cookies are required" - Auth cookies missing
- ❌ "age-restricted" - Content restricted to adults
- ❌ "account has been terminated" - Banned account
- ❌ "private video" - Not publicly playable
- ❌ "missing required data sync id" - PO token provider misconfigured
- ❌ "unable to fetch gvs po token" - POT provider down
- ❌ "requested format is not available" - Video unavailable
- ❌ "watch video on youtube" / "error code: 152" - Playback restrictions

**Location**: [backend/providers/ytdlpProvider.mjs line 110-135](backend/providers/ytdlpProvider.mjs#L110-L135)

### 2. **Circuit Breaker Cooldown** (Safety Mechanism)
**File**: [backend/resolver/streamResolver.mjs line 95-140](backend/resolver/streamResolver.mjs#L95-L140)

- Tracks failure count for yt-dlp
- After 5+ failures: **60-second cooldown** before retrying
- **Threshold**: `YTDLP_CB_THRESHOLD` (default: 5)
- **Cooldown**: `YTDLP_CB_COOLDOWN_MS` (default: 60,000ms)

**This helps prevent hammering YouTube when yt-dlp authentication is broken.**

### 3. **Configuration Issues** 
**Check these environment variables**:

| Variable | Purpose | Default |
|----------|---------|---------|
| `YT_DLP_TIMEOUT_MS` | yt-dlp request timeout | 4,500ms |
| `YT_DLP_FORMAT` | Audio format preference | `251/250/249/140/141/bestaudio/best` |
| `YT_PLAYER_CLIENTS` | YouTube player client | `web` |
| `YT_DLP_PLUGIN_DIRS` | Plugin directories (POT provider) | - |
| `YT_FETCH_POT` | When to fetch PO token | `never` |
| `YT_DLP_PROXY` | HTTP/HTTPS proxy | - |
| `YT_SOURCE_ADDRESS` | Source IP address | - |

### 4. **Queue Timeout**
**File**: [backend/resolver/streamResolver.mjs line 130](backend/resolver/streamResolver.mjs#L130)

- yt-dlp requests are queued to prevent overload
- Queue timeout default: **9,000ms** (can be configured)
- If exceeded, error message: `"task timed out"`

### 5. **YouTube API Changes**
yt-dlp requires:
- Valid **JavaScript runtime** (`YT_DLP_JS_RUNTIMES` - default: `node`)
- Proper **user-agent** headers (added automatically)
- **Player client configuration** that matches YouTube's current structure

---

## 📊 Fallback Chain (Backend)

When yt-dlp fails, resolver tries these in order:

```
1. youtubei (innertube API)        → timeout: 8s    → metric: resolver.secondary.success
2. ytdl-core (legacy)              → timeout: 8s    → metric: resolver.secondary.success
3. yt-dlp                          → timeout: 9s    → metric: resolver.primary.success
4. piped (community instance)      → timeout: 2.5s  → metric: resolver.fallback.used
5. invidious (privacy instance)    → timeout: 2.5s  → metric: resolver.fallback.used
6. saavn (music-specific)          → timeout: 8s    → metric: resolver.fallback.used
```

**Code**: [backend/resolver/streamResolver.mjs line 153-185](backend/resolver/streamResolver.mjs#L153-L185)

---

## 🔧 Debugging Steps

### 1. **Check Logs**
```bash
# Look for yt-dlp errors in backend logs
grep -i "ytdlp" /var/log/app.log
grep -i "yt-dlp returned" /var/log/app.log
grep -i "circuit.open" /var/log/app.log
```

### 2. **Test yt-dlp Directly**
```bash
# Check if binary is accessible
which yt-dlp
yt-dlp --version

# Test with a known video
yt-dlp -f 251/best --get-url "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

### 3. **Verify Environment Variables**
```bash
echo $YT_DLP_FORMAT
echo $YT_PLAYER_CLIENTS
echo $YT_DLP_TIMEOUT_MS
echo $YT_FETCH_POT
```

### 4. **Check Circuit Breaker Status**
If seeing `"yt-dlp temporarily disabled"` errors:
- Wait for cooldown period (60s default)
- Check why failures are happening
- Restart service to reset counter

### 5. **Monitor Metrics**
Look for these metrics in your monitoring:
- `resolver.primary.success` - yt-dlp succeeded
- `resolver.secondary.success` - youtubei/ytdl-core succeeded  
- `resolver.fallback.used` - piped/invidious/saavn used
- `resolver.failure` - **All providers failed** ⚠️
- `resolver.circuit.open` - yt-dlp circuit breaker triggered

---

## 💡 Frontend (yt-dlp Source Endpoint)

**File**: [src/sources/ytdlpSource.js](src/sources/ytdlpSource.js)

Process for each request:
1. Build list of endpoint candidates
2. Try each endpoint (up to 24 candidates)
3. Validate stream URL with HEAD/Range request
4. Return first valid stream URL

**Timeout**: 7,000ms per attempt

**Validation checks**:
- Content-Type starts with `audio/`
- Contains `octet-stream` or `mpegurl` or `dash+xml`
- Looks like manifest URL (.mpd, .m3u8)

---

## 🎯 Quick Fixes to Try

### Monitor in Real-Time
```bash
# If using Node.js backend
tail -f /var/log/app.log | grep -i "yt-dlp"

# Check failure rate
# Increase timeout if too aggressive:
export YT_DLP_TIMEOUT_MS=6000  # Was 4500
export FALLBACK_TIMEOUT_MS=12000  # Was 9000
```

### Verify Plugin Setup
If using PO token provider (`YT_FETCH_POT=always`):
```bash
# Check if plugin exists
ls -la bgutil-ytdlp-pot-provider/plugin/
export YT_DLP_ENABLE_BGUTIL_PLUGIN=true
export YT_FETCH_POT=always
```

### Switch to Different Player Clients
YouTube changes auth regularly. Try multiple clients:
```bash
export YT_DLP_FALLBACK_CLIENTS=android,ios,mweb,tvhtml5,web
```

---

## 📝 Summary

| Issue | Status | Fix |
|-------|--------|-----|
| Monochrome fallback not used | ✅ FIXED | Added `monochromeResolver` to PlayerContext |
| yt-dlp fails silently | ⚠️ CHECK LOGS | Review `resolver.mjs` logs, check env vars |
| Circuit breaker triggers | 📊 MONITOR | Track `resolver.circuit.open` metric |
| PO token missing | 🔧 CONFIG | Set `YT_DLP_ENABLE_BGUTIL_PLUGIN=true` |

Once monochrome fallback is enabled, your app should:
1. Try yt-dlp first (fast, reliable when working)
2. Fall back to smaller providers (piped, invidious)
3. Fall back to monochrome (full streaming support)
4. Gracefully degrade if all fail
