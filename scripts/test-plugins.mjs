#!/usr/bin/env node

/**
 * Plugin Diagnostic Test
 * Tests all configured plugin sources and endpoints
 * Run: node scripts/test-plugins.mjs
 */

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const env = process.env;

async function testEndpoint(name, url, options = {}) {
  try {
    const response = await fetch(url, {
      timeout: 8000,
      ...options,
    });
    const status = response.ok ? '✅ OK' : `⚠️  ${response.status}`;
    return { name, status, url };
  } catch (error) {
    return { name, status: `❌ ${error.message.split('\n')[0]}`, url };
  }
}

async function runTests() {
  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('  PLUGIN SOURCE DIAGNOSTIC TEST');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const tests = [];

  // ──────────────────────────────────────────────────────────────────────
  // STREAMING SOURCES
  // ──────────────────────────────────────────────────────────────────────
  console.log('📡 STREAMING SOURCES');
  console.log('──────────────────────────────────────────────────────────────');

  // YouTube (via Monochrome proxy)
  tests.push(
    testEndpoint(
      'YouTube (Monochrome proxy)',
      'https://api.monochrome.tf/stream/dQw4w9WgXcQ?format=json'
    )
  );

  // Monochrome endpoints
  tests.push(testEndpoint('Monochrome API 1', 'https://monochrome-api.samidy.com/'));
  tests.push(testEndpoint('Monochrome API 2', 'https://api.monochrome.tf/'));

  // Jamendo
  tests.push(
    testEndpoint(
      'Jamendo Search',
      'https://api.jamendo.com/v3.0/tracks/search?client_id=8e07b75a&q=test&limit=1'
    )
  );

  // SoundCloud (check if client ID is set)
  const soundcloudClientId = env.VITE_SOUNDCLOUD_CLIENT_ID || '';
  if (soundcloudClientId) {
    tests.push(
      testEndpoint(
        'SoundCloud Search',
        `https://api-v2.soundcloud.com/search/tracks?q=test&limit=1&client_id=${soundcloudClientId}`
      )
    );
  } else {
    tests.push(
      Promise.resolve({
        name: 'SoundCloud Search',
        status: '⚠️  VITE_SOUNDCLOUD_CLIENT_ID not set',
        url: 'N/A',
      })
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // METADATA SOURCES
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n📚 METADATA SOURCES');
  console.log('──────────────────────────────────────────────────────────────');

  // MusicBrainz
  tests.push(
    testEndpoint(
      'MusicBrainz Search',
      'https://musicbrainz.org/ws/2/recording?query=artist:%22test%22&fmt=json'
    )
  );

  // Discogs (requires token in production)
  const discogsToken = env.VITE_DISCOGS_TOKEN || '';
  if (discogsToken) {
    tests.push(
      testEndpoint(
        'Discogs Search',
        `https://api.discogs.com/database/search?q=test&type=release&token=${discogsToken}`
      )
    );
  } else {
    tests.push(
      Promise.resolve({
        name: 'Discogs Search',
        status: '⏭️  VITE_DISCOGS_TOKEN not set (optional)',
        url: 'N/A',
      })
    );
  }

  // ──────────────────────────────────────────────────────────────────────
  // DASHBOARD SOURCES
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n📊 DASHBOARD SOURCES');
  console.log('──────────────────────────────────────────────────────────────');

  // Deezer
  tests.push(testEndpoint('Deezer Charts', 'https://api.deezer.com/chart/0/tracks'));

  // ListenBrainz
  tests.push(
    testEndpoint('ListenBrainz Top Recordings', 'https://api.listenbrainz.org/1/stats/sitewide/recordings')
  );

  // ──────────────────────────────────────────────────────────────────────
  // BACKEND PLUGIN PROXIES
  // ──────────────────────────────────────────────────────────────────────
  console.log('\n⚙️  BACKEND PLUGIN PROXIES (localhost:3001)');
  console.log('──────────────────────────────────────────────────────────────');

  // Last.fm proxy
  const lastfmKey = env.LASTFM_API_KEY || '';
  if (lastfmKey) {
    tests.push(
      testEndpoint(
        'Last.fm Proxy',
        'http://localhost:3001/api/plugins/lastfm',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            method: 'track.updateNowPlaying',
            track: 'Test',
            artist: 'Test Artist',
          }),
        }
      )
    );
  } else {
    tests.push(
      Promise.resolve({
        name: 'Last.fm Proxy',
        status: '❌ LASTFM_API_KEY not set',
        url: 'http://localhost:3001/api/plugins/lastfm',
      })
    );
  }

  // Spotify proxy (optional)
  const spotifyClientId = env.SPOTIFY_CLIENT_ID || '';
  if (spotifyClientId) {
    tests.push(
      testEndpoint(
        'Spotify Metadata Proxy',
        'http://localhost:3001/api/plugins/spotify-metadata?title=test&artist=test'
      )
    );
  } else {
    tests.push(
      Promise.resolve({
        name: 'Spotify Metadata Proxy',
        status: '⏭️  SPOTIFY_CLIENT_ID not set (optional)',
        url: 'http://localhost:3001/api/plugins/spotify-metadata',
      })
    );
  }

  // YouTube Playlist proxy
  tests.push(
    testEndpoint(
      'YouTube Playlist Proxy',
      'http://localhost:3001/api/plugins/youtube-playlist?list=PLtest'
    )
  );

  // ──────────────────────────────────────────────────────────────────────
  // AWAIT ALL TESTS
  // ──────────────────────────────────────────────────────────────────────

  const results = await Promise.all(tests);

  results.forEach((result) => {
    console.log(`${result.status} — ${result.name}`);
  });

  // ──────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ──────────────────────────────────────────────────────────────────────

  const passing = results.filter((r) => r.status.includes('✅')).length;
  const degraded = results.filter((r) => r.status.includes('⏭️')).length;
  const failing = results.filter((r) => r.status.includes('❌') || r.status.includes('⚠️')).length;

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log(`  ✅ Passing: ${passing}  |  ⏭️  Optional: ${degraded}  |  ❌ Failing: ${failing}`);
  console.log('═══════════════════════════════════════════════════════════════\n');

  if (failing > 0) {
    console.log('⚠️  Some sources are not responding. Check:');
    console.log('   1. Internet connection');
    console.log('   2. VPN/proxy blocks');
    console.log('   3. Rate limits');
    console.log('   4. Backend server running on localhost:3001\n');
  }

  process.exit(failing > 5 ? 1 : 0);
}

runTests().catch((err) => {
  console.error('Test error:', err.message);
  process.exit(1);
});
