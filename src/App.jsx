import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Play, User, Shuffle, ListPlus, Sun, Moon, ChevronRight, Heart, Clock, Music, ListMusic, Disc3, Sparkles, SkipForward } from 'lucide-react';
import { usePlayer } from './context/PlayerContext';
import { youtubeApi } from './api/youtube';
import { recommendationsApi } from './api/recommendations';
import { useLocalStorage } from './hooks/useLocalStorage';
import { buildHistory, insertTrackNext } from './utils/playerState';
import { getOrCreateUserId } from './utils/userId';
import Sidebar from './components/Sidebar';
import SearchBar from './components/SearchBar';
import TrackCard from './components/TrackCard';
import PlaybackBar from './components/PlaybackBar';
import LyricsModal from './components/LyricsModal';
import QueueViewer from './components/QueueViewer';
import MobilePlayer from './components/MobilePlayer';
import AsyncState from './components/AsyncState';
import { logError } from './utils/logger';

const COLORS = ['#ec4899', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];
const randomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];
const onlyYoutube = (tracks) => (Array.isArray(tracks) ? tracks.filter((t) => t && t.source !== 'saavn') : []);

/* ── Radio station definitions ── */
const RADIO_STATIONS = [
  { id: 'bollywood', name: 'Bollywood Hits', query: 'Bollywood hits 2025', gradient: 'linear-gradient(135deg, #e91e63, #ff5722)' },
  { id: 'pop', name: 'Pop Hits', query: 'Pop hits 2025', gradient: 'linear-gradient(135deg, #2196f3, #00bcd4)' },
  { id: 'lofi', name: 'Lo-Fi Chill', query: 'Lofi chill beats', gradient: 'linear-gradient(135deg, #4caf50, #8bc34a)' },
  { id: 'hiphop', name: 'Hip Hop', query: 'Hip hop hits 2025', gradient: 'linear-gradient(135deg, #ff9800, #f44336)' },
  { id: 'rock', name: 'Rock Classics', query: 'Rock classics best', gradient: 'linear-gradient(135deg, #607d8b, #455a64)' },
  { id: 'indie', name: 'Indie Vibes', query: 'Indie music popular', gradient: 'linear-gradient(135deg, #9c27b0, #e91e63)' },
  { id: 'edm', name: 'EDM', query: 'EDM dance music 2025', gradient: 'linear-gradient(135deg, #00bcd4, #3f51b5)' },
  { id: 'devotional', name: 'Devotional', query: 'Devotional songs Hindi', gradient: 'linear-gradient(135deg, #ff9800, #ffc107)' },
  { id: 'punjabi', name: 'Punjabi', query: 'Punjabi songs 2025 hits', gradient: 'linear-gradient(135deg, #f44336, #e91e63)' },
  { id: 'retro', name: '90s Throwback', query: '90s hits throwback', gradient: 'linear-gradient(135deg, #795548, #ff9800)' },
  { id: 'your-station', name: 'Your Station', query: null, gradient: 'linear-gradient(135deg, #fc3c44, #a855f7)', isPersonal: true },
  { id: 'trending', name: 'Trending Now', query: 'Trending songs 2025', gradient: 'linear-gradient(135deg, #10b981, #06b6d4)' },
];

/* ── Library categories ── */
const LIBRARY_CATEGORIES = [
  { id: 'playlists', label: 'Playlists', icon: ListMusic },
  { id: 'favorites', label: 'Favorites', icon: Heart },
  { id: 'history', label: 'Recently Played', icon: Clock },
  { id: 'most-played', label: 'Most Played', icon: Music },
  { id: 'made-for-you', label: 'Made For You', icon: Sparkles },
];

function App() {
  const {
    playTrack,
    currentTrack,
    dominantColor,
    getRecommendationsFor,
    togglePlay,
    skipNext,
    skipPrev,
    queue,
    queueIndex,
    setQueue,
  } = usePlayer();

  const [activeTab, setActiveTab] = useState('home');
  const [librarySubView, setLibrarySubView] = useState(null); // tracks sub-view within Library
  const [topTracks, setTopTracks] = useState([]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discoverSections, setDiscoverSections] = useState([]);
  const [personalMix, setPersonalMix] = useState(null);
  const [dailyMix, setDailyMix] = useState(null);
  const [madeForYou, setMadeForYou] = useState(null);
  const [basedOnRecent, setBasedOnRecent] = useState(null);
  const [isLyricsOpen, setIsLyricsOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [trendingError, setTrendingError] = useState(null);
  const [isDiscoverLoading, setIsDiscoverLoading] = useState(false);
  const [discoverError, setDiscoverError] = useState(null);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [radioLoading, setRadioLoading] = useState(null);
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'dark');

  const [contextMenu, setContextMenu] = useState({ open: false, x: 0, y: 0, track: null, trackList: [] });
  const [contextMenuFocusIndex, setContextMenuFocusIndex] = useState(0);
  const contextMenuActionRefs = useRef([]);

  const [favorites, setFavorites] = useLocalStorage('aura-favorites', []);
  const [playlists, setPlaylists] = useLocalStorage('aura-playlists', []);
  const [history, setHistory] = useLocalStorage('aura-history', []);
  const [searchCache, setSearchCache] = useState({});
  const [playlistSubOpen, setPlaylistSubOpen] = useState(false);

  /* ════════════════ Theme toggle ════════════════ */
  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem('aura-theme', next);
      return next;
    });
  }, []);

  /* ════════════════ Listening stats ════════════════ */
  const listeningStats = useMemo(() => {
    if (!history || history.length === 0) return { totalMinutes: 0, totalPlays: 0, topTracks: [], topArtists: [] };
    let totalDuration = 0;
    const trackMap = new Map();
    const artistMap = new Map();
    for (const track of history) {
      if (!track) continue;
      totalDuration += track.duration || 0;
      if (track.id) { const e = trackMap.get(track.id) || { track, count: 0 }; e.count += 1; trackMap.set(track.id, e); }
      if (track.artist) artistMap.set(track.artist, (artistMap.get(track.artist) || 0) + 1);
    }
    return {
      totalMinutes: Math.round(totalDuration / 60),
      totalPlays: history.length,
      topTracks: Array.from(trackMap.values()).sort((a, b) => b.count - a.count).slice(0, 3),
      topArtists: Array.from(artistMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 3),
    };
  }, [history]);

  /* ════════════════ History tracking ════════════════ */
  useEffect(() => {
    if (!currentTrack) return;
    setHistory((prev) => buildHistory(prev, currentTrack));
  }, [currentTrack, setHistory]);

  /* ════════════════ Load trending ════════════════ */
  const loadTrending = useCallback(async () => {
    setIsTrendingLoading(true);
    setTrendingError(null);
    try {
      const userId = getOrCreateUserId();
      const recoRes = await recommendationsApi.getRecommendationsSafe(userId);
      if (recoRes.ok && recoRes.data?.trending?.length) {
        setTopTracks(onlyYoutube(recoRes.data.trending));
        return;
      }
      const ytFallback = await youtubeApi.searchSongsSafe('Top hits', 20);
      if (!ytFallback.ok) { setTopTracks([]); setTrendingError(ytFallback.error || 'Unable to load trending songs.'); }
      else setTopTracks(onlyYoutube(ytFallback.data || []));
    } catch (error) {
      logError('app.loadTrending', error);
      setTopTracks([]);
      setTrendingError('Unable to load trending songs.');
    } finally { setIsTrendingLoading(false); }
  }, []);

  useEffect(() => { loadTrending(); }, [loadTrending]);

  /* ════════════════ Load discover (for Home + New) ════════════════ */
  const loadDiscover = useCallback(async () => {
    setIsDiscoverLoading(true);
    setDiscoverError(null);
    try {
      const [newRes, popularRes] = await Promise.all([
        youtubeApi.searchSongsSafe('New releases', 8),
        youtubeApi.searchSongsSafe('Popular right now', 8),
      ]);
      if (!newRes.ok && !popularRes.ok) setDiscoverError('Could not load discover sections.');
      setDiscoverSections([
        { title: 'New Releases', tracks: onlyYoutube(newRes.data || []) },
        { title: 'Popular Right Now', tracks: onlyYoutube(popularRes.data || []) },
      ]);

      const seedTrack = favorites[0] || history[0] || null;
      if (seedTrack && getRecommendationsFor) {
        try {
          const recs = await getRecommendationsFor(seedTrack);
          setPersonalMix(recs?.length ? { title: `Because you listened to ${seedTrack.title}`, tracks: onlyYoutube(recs) } : null);
        } catch (e) { logError('app.personalMix', e); setPersonalMix(null); }
      } else setPersonalMix(null);

      const seenIds = new Set();
      const dmTracks = [];
      for (const t of onlyYoutube([...favorites, ...history])) {
        if (!t?.id || seenIds.has(t.id)) continue;
        seenIds.add(t.id);
        dmTracks.push(t);
        if (dmTracks.length >= 30) break;
      }
      setDailyMix(dmTracks.length ? { title: 'Daily Mix', tracks: dmTracks } : null);

      try {
        const userId = getOrCreateUserId();
        const recoRes = await recommendationsApi.getRecommendationsSafe(userId);
        if (recoRes.ok && recoRes.data) {
          setMadeForYou(recoRes.data.madeForYou?.length ? { title: 'Made for you', tracks: onlyYoutube(recoRes.data.madeForYou) } : null);
          setBasedOnRecent(recoRes.data.basedOnRecent?.length ? { title: 'Based on your recent plays', tracks: onlyYoutube(recoRes.data.basedOnRecent) } : null);
        } else { setMadeForYou(null); setBasedOnRecent(null); }
      } catch { setMadeForYou(null); setBasedOnRecent(null); }
    } catch (error) {
      logError('app.loadDiscover', error);
      setDiscoverError('Discover is unavailable right now.');
      setDiscoverSections([]); setPersonalMix(null); setDailyMix(null); setMadeForYou(null); setBasedOnRecent(null);
    } finally { setIsDiscoverLoading(false); }
  }, [favorites, history, getRecommendationsFor]);

  useEffect(() => { if (activeTab === 'home' || activeTab === 'new') loadDiscover(); }, [activeTab, loadDiscover]);

  /* ════════════════ Keyboard shortcuts ════════════════ */
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      else if (e.code === 'ArrowRight') { e.preventDefault(); skipNext(); }
      else if (e.code === 'ArrowLeft') { e.preventDefault(); skipPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [togglePlay, skipNext, skipPrev]);

  /* ════════════════ Search ════════════════ */
  const handleSearch = useCallback(async (query, options = {}) => {
    const { force = false } = options;
    setSearchQuery(query);
    setActiveTab('search');
    const term = query.trim();
    if (!term) { setSearchResults([]); setSearchError(null); return; }
    if (!force && searchCache[term]) { setSearchResults(searchCache[term]); setSearchError(null); return; }
    setIsSearchLoading(true);
    setSearchError(null);
    try {
      const ytRes = await youtubeApi.searchSongsSafe(term, 20);
      if (!ytRes.ok) { setSearchResults([]); setSearchError(ytRes.error || 'Search unavailable.'); return; }
      const combined = onlyYoutube(ytRes.data || []);
      setSearchResults(combined);
      setSearchCache((prev) => ({ ...prev, [term]: combined }));
    } catch (error) {
      logError('app.handleSearch', error);
      setSearchResults([]);
      setSearchError('Search unavailable.');
    } finally { setIsSearchLoading(false); }
  }, [searchCache]);

  /* ════════════════ Favorites & playlists ════════════════ */
  const toggleFavorite = useCallback((track) => {
    setFavorites((prev) =>
      prev.some((f) => f.id === track.id) ? prev.filter((f) => f.id !== track.id) : [...prev, track]
    );
  }, [setFavorites]);

  const createPlaylist = (name) => {
    setPlaylists([...playlists, { id: Date.now().toString(), name, color: randomColor(), tracks: [] }]);
  };

  const deletePlaylist = (id) => {
    setPlaylists(playlists.filter((p) => p.id !== id));
    if (librarySubView === `playlist-${id}`) setLibrarySubView(null);
  };

  /* ════════════════ Radio station player ════════════════ */
  const playStation = useCallback(async (station) => {
    setRadioLoading(station.id);
    try {
      let tracks = [];
      if (station.isPersonal) {
        const userId = getOrCreateUserId();
        const recoRes = await recommendationsApi.getRecommendationsSafe(userId);
        if (recoRes.ok && recoRes.data) {
          tracks = onlyYoutube([
            ...(recoRes.data.madeForYou || []),
            ...(recoRes.data.basedOnRecent || []),
            ...(recoRes.data.trending || []),
          ]);
        }
        if (tracks.length === 0) {
          // Fallback: use favorites + history as seed
          tracks = onlyYoutube([...favorites, ...history]).slice(0, 20);
        }
      } else {
        const res = await youtubeApi.searchSongsSafe(station.query, 20);
        if (res.ok) tracks = onlyYoutube(res.data || []);
      }
      if (tracks.length > 0) {
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        playTrack(shuffled[0], shuffled, { mode: 'radio' });
      }
    } catch (e) {
      logError('app.playStation', e);
    } finally { setRadioLoading(null); }
  }, [favorites, history, playTrack]);

  /* ════════════════ Context menu ════════════════ */
  const handleTrackContextMenu = (event, track, trackList) => {
    setContextMenu({ open: true, x: event.clientX, y: event.clientY, track, trackList: trackList || [] });
  };

  const closeContextMenu = useCallback(() => {
    setContextMenu((p) => ({ ...p, open: false, track: null }));
    setPlaylistSubOpen(false);
  }, []);

  const handlePlayNextFromMenu = useCallback(() => {
    const track = contextMenu.track;
    if (!track) return;
    if (!queue?.length || queueIndex < 0) { playTrack(track, [track]); closeContextMenu(); return; }
    setQueue((prev) => insertTrackNext(prev, queueIndex, track));
    closeContextMenu();
  }, [closeContextMenu, contextMenu.track, playTrack, queue, queueIndex, setQueue]);

  const handleStartRadioFromMenu = useCallback(() => {
    const track = contextMenu.track;
    if (!track) return;
    playTrack(track, contextMenu.trackList || [], { mode: 'radio' });
    closeContextMenu();
  }, [closeContextMenu, contextMenu.track, contextMenu.trackList, playTrack]);

  const handleToggleFavoriteFromMenu = useCallback(() => {
    if (contextMenu.track) toggleFavorite(contextMenu.track);
    closeContextMenu();
  }, [closeContextMenu, contextMenu.track, toggleFavorite]);

  const handleAddToPlaylist = useCallback((playlistId) => {
    const track = contextMenu.track;
    if (!track) return;
    setPlaylists((prev) => prev.map((pl) =>
      pl.id === playlistId && !pl.tracks.some((t) => t.id === track.id)
        ? { ...pl, tracks: [...pl.tracks, track] } : pl
    ));
    setPlaylistSubOpen(false);
    closeContextMenu();
  }, [closeContextMenu, contextMenu.track, setPlaylists]);

  const contextMenuActions = [handlePlayNextFromMenu, handleStartRadioFromMenu, handleToggleFavoriteFromMenu];

  useEffect(() => {
    if (!contextMenu.open) return;
    setContextMenuFocusIndex(0);
    const t = setTimeout(() => contextMenuActionRefs.current[0]?.focus(), 0);
    return () => clearTimeout(t);
  }, [contextMenu.open]);

  /* ════════════════ Computed track lists ════════════════ */
  const getMostPlayed = useMemo(() => {
    const counts = new Map();
    for (const t of history) { if (!t?.id) continue; const e = counts.get(t.id) || { track: t, count: 0 }; e.count += 1; counts.set(t.id, e); }
    return Array.from(counts.values()).sort((a, b) => b.count - a.count).map((e) => e.track);
  }, [history]);

  const handlePlayAll = useCallback((tracks) => {
    if (tracks.length > 0) playTrack(tracks[0], tracks);
  }, [playTrack]);

  const handleShuffleAll = useCallback((tracks) => {
    if (tracks.length > 0) {
      const s = [...tracks].sort(() => Math.random() - 0.5);
      playTrack(s[0], s);
    }
  }, [playTrack]);

  /* ════════════════ Tab change handler (reset sub-views) ════════════════ */
  const handleTabChange = useCallback((tab) => {
    setActiveTab(tab);
    setLibrarySubView(null);
  }, []);

  /* ════════════════ Render helpers ════════════════ */
  const renderTrackList = (tracks, title, options = {}) => {
    const { showActions = true, variant = 'list' } = options;
    const displayed = onlyYoutube(tracks).slice(0, 150);
    return (
      <section className="track-section">
        <div className="section-header">
          <h2>{title}</h2>
          {showActions && displayed.length > 1 && (
            <div className="section-header-actions">
              <button className="section-action-btn" onClick={() => handlePlayAll(displayed)} type="button"><Play size={14} /> Play</button>
              <button className="section-action-btn" onClick={() => handleShuffleAll(displayed)} type="button"><Shuffle size={14} /> Shuffle</button>
            </div>
          )}
        </div>
        {displayed.length === 0 ? (
          <div className="empty-state">No tracks available</div>
        ) : (
          <div className="track-grid" role="list">
            {displayed.map((track, index) => (
              <TrackCard
                key={track.id + index}
                track={track}
                isActive={currentTrack?.id === track.id}
                isPlaying={currentTrack?.id === track.id}
                isFav={favorites.some((f) => f.id === track.id)}
                onPlay={(t) => playTrack(t, displayed, { mode: variant === 'tile' ? 'radio' : 'list' })}
                onFav={toggleFavorite}
                onContextMenu={(e, t) => handleTrackContextMenu(e, t, displayed)}
                variant={variant}
              />
            ))}
          </div>
        )}
      </section>
    );
  };

  const renderHorizontalSection = (tracks, title) => {
    const displayed = onlyYoutube(tracks).slice(0, 20);
    if (displayed.length === 0) return null;
    return (
      <section className="track-section" style={{ padding: 0 }}>
        <div className="section-header" style={{ padding: '0 16px' }}>
          <h2>{title}</h2>
        </div>
        <div className="horizontal-scroll">
          {displayed.map((track, i) => (
            <TrackCard
              key={track.id + i}
              track={track}
              isActive={currentTrack?.id === track.id}
              isPlaying={currentTrack?.id === track.id}
              isFav={favorites.some((f) => f.id === track.id)}
              onPlay={(t) => playTrack(t, displayed, { mode: 'radio' })}
              onFav={toggleFavorite}
              onContextMenu={(e, t) => handleTrackContextMenu(e, t, displayed)}
              variant="tile"
            />
          ))}
        </div>
      </section>
    );
  };

  /* ════════════════ RENDER ════════════════ */
  const tabTitle = activeTab === 'home' ? 'Home' : activeTab === 'new' ? 'New' : activeTab === 'radio' ? 'Radio' : activeTab === 'library' ? 'Library' : activeTab === 'search' ? 'Search' : '';

  return (
    <div className="app-container">
      <main className="main-content">
        {/* Top bar (not shown on search tab — search has its own) */}
        {activeTab !== 'search' && (
          <header className="top-bar">
            {librarySubView ? (
              <button className="icon-btn" onClick={() => setLibrarySubView(null)} style={{ fontSize: 16 }}>
                ← {tabTitle}
              </button>
            ) : (
              <h1 className="top-bar-title">{tabTitle}</h1>
            )}
            <div className="top-bar-actions">
              <button className="theme-toggle-btn" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              <div className="user-profile" aria-label="User profile">
                <div className="avatar"><User size={16} color="white" /></div>
              </div>
            </div>
          </header>
        )}

        <div className="content-scroll">
          <div key={activeTab + (librarySubView || '')} className="tab-content-enter">

            {/* ═══════════ HOME TAB ═══════════ */}
            {activeTab === 'home' && (
              <>
                {isTrendingLoading && !topTracks.length && (
                  <AsyncState state="loading" title="Loading" message="Fetching trending songs..." />
                )}
                {!isTrendingLoading && trendingError && !topTracks.length && (
                  <AsyncState state="error" title="Could not load" message={trendingError} onRetry={loadTrending} />
                )}

                {dailyMix && renderHorizontalSection(dailyMix.tracks, dailyMix.title)}
                {topTracks.length > 0 && renderTrackList(topTracks, 'Trending Songs')}
                {basedOnRecent && renderTrackList(basedOnRecent.tracks, basedOnRecent.title)}
                {personalMix && renderHorizontalSection(personalMix.tracks, personalMix.title)}
              </>
            )}

            {/* ═══════════ NEW TAB ═══════════ */}
            {activeTab === 'new' && (
              <>
                {isDiscoverLoading && !discoverSections.length && (
                  <AsyncState state="loading" title="Loading" message="Building discover..." />
                )}
                {!isDiscoverLoading && discoverError && !discoverSections.length && (
                  <AsyncState state="error" title="Could not load" message={discoverError} onRetry={loadDiscover} />
                )}

                {discoverSections.map((section, i) => (
                  i === 0
                    ? renderTrackList(section.tracks, section.title, { key: i })
                    : renderHorizontalSection(section.tracks, section.title)
                ))}

                {madeForYou && renderTrackList(madeForYou.tracks, madeForYou.title)}
              </>
            )}

            {/* ═══════════ RADIO TAB ═══════════ */}
            {activeTab === 'radio' && (
              <div className="radio-grid">
                {RADIO_STATIONS.map((station) => (
                  <button
                    key={station.id}
                    className="radio-card"
                    style={{ background: station.gradient }}
                    onClick={() => playStation(station)}
                    disabled={radioLoading === station.id}
                    type="button"
                  >
                    <div className="radio-card-title">
                      {radioLoading === station.id ? 'Loading...' : station.name}
                    </div>
                    <div className="radio-card-subtitle">
                      {station.isPersonal ? 'Based on your taste' : 'Tap to play'}
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* ═══════════ LIBRARY TAB ═══════════ */}
            {activeTab === 'library' && !librarySubView && (
              <>
                <nav className="library-categories">
                  {LIBRARY_CATEGORIES.map(({ id, label, icon: Icon }) => (
                    <button key={id} className="library-category-item" onClick={() => setLibrarySubView(id)} type="button">
                      <Icon size={22} className="library-category-icon" />
                      <span className="library-category-label">{label}</span>
                      <ChevronRight size={18} className="library-category-chevron" />
                    </button>
                  ))}
                  {playlists.map((pl) => (
                    <button key={pl.id} className="library-category-item" onClick={() => setLibrarySubView(`playlist-${pl.id}`)} type="button">
                      <Disc3 size={22} className="library-category-icon" style={{ color: pl.color }} />
                      <span className="library-category-label">{pl.name}</span>
                      <ChevronRight size={18} className="library-category-chevron" />
                    </button>
                  ))}
                </nav>

                {/* Recently Added */}
                {history.length > 0 && renderHorizontalSection(history.slice(0, 15), 'Recently Added')}
              </>
            )}

            {/* Library sub-views */}
            {activeTab === 'library' && librarySubView === 'favorites' && renderTrackList(favorites, 'Favorites')}
            {activeTab === 'library' && librarySubView === 'history' && (
              <>
                {history.length > 0 && (
                  <div className="history-stats">
                    <div className="history-stats-main">
                      <h3>Listening summary</h3>
                      <p>{listeningStats.totalMinutes} min · {listeningStats.totalPlays} plays</p>
                    </div>
                    <div className="history-stats-meta">
                      {listeningStats.topArtists.length > 0 && (
                        <div className="history-stat-column">
                          <span className="history-stat-label">Top artists</span>
                          <span className="history-stat-value">{listeningStats.topArtists.map((a) => a.name).join(', ')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {renderTrackList(history, 'Recently Played')}
              </>
            )}
            {activeTab === 'library' && librarySubView === 'most-played' && renderTrackList(getMostPlayed, 'Most Played')}
            {activeTab === 'library' && librarySubView === 'playlists' && (
              <section className="track-section">
                <div className="section-header">
                  <h2>Playlists</h2>
                  <button className="section-action-btn" onClick={() => {
                    const name = prompt('Playlist name:');
                    if (name?.trim()) createPlaylist(name.trim());
                  }} type="button"><ListPlus size={14} /> New</button>
                </div>
                {playlists.length === 0 ? (
                  <div className="empty-state">No playlists yet. Create one!</div>
                ) : (
                  <nav className="library-categories">
                    {playlists.map((pl) => (
                      <button key={pl.id} className="library-category-item" onClick={() => setLibrarySubView(`playlist-${pl.id}`)} type="button">
                        <Disc3 size={22} style={{ color: pl.color }} />
                        <span className="library-category-label">{pl.name}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-300)' }}>{pl.tracks.length}</span>
                        <ChevronRight size={18} className="library-category-chevron" />
                      </button>
                    ))}
                  </nav>
                )}
              </section>
            )}
            {activeTab === 'library' && librarySubView === 'made-for-you' && (
              madeForYou ? renderTrackList(madeForYou.tracks, madeForYou.title) : <div className="empty-state">Start listening to build your personalized mix</div>
            )}
            {activeTab === 'library' && librarySubView?.startsWith('playlist-') && (() => {
              const pl = playlists.find((p) => p.id === librarySubView.replace('playlist-', ''));
              if (!pl) return <div className="empty-state">Playlist not found</div>;
              return renderTrackList(pl.tracks, pl.name);
            })()}

            {/* ═══════════ SEARCH TAB ═══════════ */}
            {activeTab === 'search' && (
              <>
                <div style={{ padding: '12px 16px 8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <h1 className="top-bar-title" style={{ flex: 1 }}>Search</h1>
                    <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle theme">
                      {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                  </div>
                  <SearchBar onSearch={handleSearch} />
                </div>

                {isSearchLoading && <AsyncState state="loading" title="Searching" message="Looking for songs..." />}
                {!isSearchLoading && searchError && !searchResults.length && (
                  <AsyncState state="error" title="Search failed" message={searchError} onRetry={() => handleSearch(searchQuery, { force: true })} />
                )}
                {!isSearchLoading && !searchError && searchResults.length === 0 && searchQuery && (
                  <div className="empty-state">No results for &ldquo;{searchQuery}&rdquo;</div>
                )}
                {searchResults.length > 0 && renderTrackList(searchResults, `Results for "${searchQuery}"`)}

                {/* Browse suggestions when empty */}
                {!searchQuery && topTracks.length > 0 && renderTrackList(topTracks.slice(0, 10), 'Trending')}
              </>
            )}

          </div>
        </div>
      </main>

      {/* Bottom navigation */}
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Players */}
      <PlaybackBar onOpenLyrics={() => setIsLyricsOpen(true)} onOpenQueue={() => setIsQueueOpen(true)} />
      <MobilePlayer onOpenLyrics={() => setIsLyricsOpen(true)} onOpenQueue={() => setIsQueueOpen(true)} />
      <LyricsModal isOpen={isLyricsOpen} onClose={() => setIsLyricsOpen(false)} />
      <QueueViewer isOpen={isQueueOpen} onClose={() => setIsQueueOpen(false)} />

      {/* Context Menu — Bottom Sheet */}
      {contextMenu.open && contextMenu.track && (
        <div className="track-context-menu-overlay" onClick={closeContextMenu}>
          <div
            className="track-context-menu"
            onClick={(e) => e.stopPropagation()}
            role="menu"
            aria-label="Track options"
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.preventDefault(); closeContextMenu(); return; }
              if (e.key === 'ArrowDown') { e.preventDefault(); const n = (contextMenuFocusIndex + 1) % contextMenuActions.length; setContextMenuFocusIndex(n); contextMenuActionRefs.current[n]?.focus(); }
              if (e.key === 'ArrowUp') { e.preventDefault(); const n = (contextMenuFocusIndex - 1 + contextMenuActions.length) % contextMenuActions.length; setContextMenuFocusIndex(n); contextMenuActionRefs.current[n]?.focus(); }
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); contextMenuActions[contextMenuFocusIndex]?.(); }
            }}
          >
            {/* Track info header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px 12px', borderBottom: '1px solid var(--divider)' }}>
              {contextMenu.track.coverArt && <img src={contextMenu.track.coverArt} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />}
              <div style={{ overflow: 'hidden' }}>
                <div style={{ fontWeight: 700, fontSize: 15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{contextMenu.track.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-300)' }}>{contextMenu.track.artist}</div>
              </div>
            </div>

            <button className="track-context-item" onClick={handlePlayNextFromMenu} role="menuitem" ref={(el) => { contextMenuActionRefs.current[0] = el; }} type="button">
              <SkipForward size={18} /> Play Next
            </button>
            <button className="track-context-item" onClick={handleStartRadioFromMenu} role="menuitem" ref={(el) => { contextMenuActionRefs.current[1] = el; }} type="button">
              <Music size={18} /> Start Song Radio
            </button>
            <button className="track-context-item" onClick={handleToggleFavoriteFromMenu} role="menuitem" ref={(el) => { contextMenuActionRefs.current[2] = el; }} type="button">
              <Heart size={18} /> {favorites.some((f) => f.id === contextMenu.track.id) ? 'Remove from Favorites' : 'Add to Favorites'}
            </button>
            {playlists.length > 0 && (
              <div className="ctx-playlist-group">
                <button className="track-context-item ctx-playlist-toggle" onClick={() => setPlaylistSubOpen((p) => !p)} role="menuitem" type="button">
                  <ListPlus size={18} /> Add to Playlist
                </button>
                {playlistSubOpen && (
                  <div className="ctx-playlist-sub">
                    {playlists.map((pl) => (
                      <button key={pl.id} className="track-context-item ctx-playlist-item" onClick={() => handleAddToPlaylist(pl.id)} role="menuitem" type="button">
                        <span className="ctx-playlist-dot" style={{ background: pl.color }} />
                        {pl.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
