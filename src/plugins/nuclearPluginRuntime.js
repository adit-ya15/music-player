import pluginRegistry from './nuclearPlugins.json';

function hasConfiguredValue(value) {
  return String(value || '').trim().length > 0;
}

const PLUGIN_RULES = {
  'nuclear-plugin-discogs': {
    requirements: ['VITE_DISCOGS_TOKEN'],
    collaboration: 'Enriches album/genre metadata and complements MusicBrainz canonical IDs.',
  },
  'nuclear-plugin-youtube': {
    requirements: ['VITE_YTDLP_ENDPOINTS'],
    collaboration: 'Primary streaming source. Runs in hedged mode with Monochrome for low latency.',
  },
  'nuclear-plugin-bandcamp': {
    requirements: ['VITE_BANDCAMP_SEARCH_ENDPOINT'],
    collaboration: 'Adds metadata and optional discovery rows without touching core playback resolver.',
  },
  'nuclear-plugin-soundcloud': {
    requirements: ['VITE_SOUNDCLOUD_CLIENT_ID'],
    collaboration: 'Acts as secondary streaming provider and search contributor.',
  },
  'nuclear-plugin-something': {
    requirements: [],
    collaboration: 'Metadata-only plugin that augments artist/album details.',
  },
  'nuclear-plugin-deezer-dashboard': {
    requirements: [],
    collaboration: 'Adds public chart/release dashboard rows and does not alter playback priority.',
  },
  'nuclear-plugin-musicbrainz': {
    requirements: [],
    collaboration: 'Canonical metadata provider used before Discogs/Spotify merge stage.',
  },
  'nuclear-plugin-listenbrainz-dashboard': {
    requirements: [],
    collaboration: 'Adds listening-trend dashboard rows and can coexist with Deezer dashboard.',
  },
  'nuclear-plugin-lastfm': {
    requirements: [],
    collaboration: 'Receives now-playing and scrobble events from playback lifecycle hooks.',
  },
  'nuclear-plugin-youtube-playlists': {
    requirements: [],
    collaboration: 'Imports playlist entries, then resolves tracks through normal source pipeline.',
  },
  'nuclear-plugin-monochrome': {
    requirements: [],
    collaboration: 'Low-latency streaming fallback that races with YouTube resolver.',
  },
};

function buildStatus(pluginId) {
  const env = import.meta?.env || {};
  const rule = PLUGIN_RULES[pluginId] || { requirements: [], collaboration: '' };
  const missingRequirements = rule.requirements.filter((key) => !hasConfiguredValue(env[key]));

  switch (pluginId) {
    case 'nuclear-plugin-youtube': {
      const status = missingRequirements.length ? 'degraded' : 'ready';
      return {
        status,
        note: status === 'ready'
          ? 'Client yt-dlp endpoints are configured.'
          : 'YouTube stream plugin is active in fallback mode until yt-dlp endpoints are configured.',
        missingRequirements,
        collaboration: rule.collaboration,
      };
    }
    case 'nuclear-plugin-monochrome':
    case 'nuclear-plugin-deezer-dashboard':
    case 'nuclear-plugin-musicbrainz':
    case 'nuclear-plugin-listenbrainz-dashboard': {
      return {
        status: 'ready',
        note: 'Plugin is active with public endpoints and no mandatory credentials.',
        missingRequirements,
        collaboration: rule.collaboration,
      };
    }
    case 'nuclear-plugin-soundcloud':
    case 'nuclear-plugin-lastfm':
    case 'nuclear-plugin-youtube-playlists':
    case 'nuclear-plugin-discogs':
    case 'nuclear-plugin-bandcamp':
    case 'nuclear-plugin-something': {
      const status = missingRequirements.length ? 'degraded' : 'ready';
      return {
        status,
        note: missingRequirements.length
          ? `Missing configuration: ${missingRequirements.join(', ')}`
          : 'Plugin endpoint credentials are configured.',
        missingRequirements,
        collaboration: rule.collaboration,
      };
    }
    default:
      return {
        status: 'catalog',
        note: 'Plugin catalog imported. Runtime adapter can be enabled as API keys/providers are configured.',
        missingRequirements,
        collaboration: rule.collaboration,
      };
  }
}

export function getNuclearPluginCatalog({ disabledIds = [] } = {}) {
  const disabled = new Set(Array.isArray(disabledIds) ? disabledIds : []);

  return (pluginRegistry?.plugins || []).map((plugin) => {
    const runtime = buildStatus(plugin.id);
    const enabled = !disabled.has(plugin.id);
    return {
      ...plugin,
      enabled,
      requirements: (PLUGIN_RULES[plugin.id]?.requirements || []).slice(),
      status: enabled ? runtime.status : 'disabled',
      note: enabled ? runtime.note : 'Disabled by user preference.',
      missingRequirements: enabled ? (runtime.missingRequirements || []) : [],
      collaboration: runtime.collaboration || PLUGIN_RULES[plugin.id]?.collaboration || '',
    };
  });
}

export function isPluginEnabled(catalog, pluginId) {
  const row = (catalog || []).find((item) => item.id === pluginId);
  return Boolean(row && row.enabled && row.status !== 'disabled');
}

export function getPluginSetupChecklist(catalog) {
  return (catalog || []).map((plugin) => ({
    id: plugin.id,
    name: plugin.name,
    status: plugin.status,
    required: Array.isArray(plugin.requirements) ? plugin.requirements : [],
    missing: Array.isArray(plugin.missingRequirements) ? plugin.missingRequirements : [],
    enabled: Boolean(plugin.enabled),
  }));
}
