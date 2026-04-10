import React, { useCallback, useEffect, useState } from 'react';
import { DNAHelix } from './DNAHelix';
import { GenreBreakdown } from './GenreBreakdown';
import { SonicTwins } from './SonicTwins';
import { UserDNACard } from './UserDNACard';
import { buildApiUrl } from '../api/apiBase';
import { getStoredAuthSession } from '../utils/authSession';
import './musicDna.css';

const DNA_CACHE_KEY = 'null-music-dna-cache';
const DNA_CACHE_TTL_MS = 1000 * 60 * 60 * 24;

function readCachedDNA() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DNA_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.dna || !parsed?.savedAt) return null;
    if (Date.now() - Number(parsed.savedAt) > DNA_CACHE_TTL_MS) return null;
    return parsed.dna;
  } catch {
    return null;
  }
}

function saveCachedDNA(nextDNA) {
  if (typeof window === 'undefined' || !nextDNA) return;
  try {
    window.localStorage.setItem(DNA_CACHE_KEY, JSON.stringify({
      savedAt: Date.now(),
      dna: nextDNA,
    }));
  } catch {
    // ignore storage failures
  }
}

function getAuthHeaders() {
  const token = getStoredAuthSession()?.token || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function parseJsonOrThrow(response, fallbackMessage) {
  const contentType = String(response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw new Error(fallbackMessage);
  }
  return response.json();
}

/**
 * DNAProfile Component
 * Main display for user's music DNA profile
 */
export function DNAProfile() {
  const [dna, setDNA] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const isOffline = typeof navigator !== 'undefined' ? !navigator.onLine : false;

  const fetchDNA = useCallback(async () => {
    try {
      const offlineNow = typeof navigator !== 'undefined' ? !navigator.onLine : false;
      const cachedDNA = readCachedDNA();
      if (cachedDNA && offlineNow) {
        setDNA(cachedDNA);
        setError('You are offline. Showing your last saved Music DNA.');
        setLoading(false);
        return;
      }

      if (cachedDNA && !offlineNow) {
        setDNA(cachedDNA);
        setLoading(false);
      } else {
        setLoading(true);
      }

      const response = await fetch(buildApiUrl('/user/dna'), {
        headers: {
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        if (cachedDNA) {
          setDNA(cachedDNA);
          setError('Music DNA service is unavailable. Showing your cached profile.');
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch DNA: ${response.statusText}`);
      }

      const data = await parseJsonOrThrow(response, 'Music DNA service returned an invalid response. Check API base URL.');
      setDNA(data.dna);
      saveCachedDNA(data.dna);
      setError(null);
    } catch (err) {
      const cachedDNA = readCachedDNA();
      if (cachedDNA) {
        setDNA(cachedDNA);
        setError('Music DNA is offline. Showing your cached profile.');
      } else {
        setError(err.message || 'Failed to load DNA profile');
      }
      console.error('Error fetching DNA:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefreshDNA = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl('/user/dna/refresh'), {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to refresh DNA: ${response.statusText}`);
      }

      const data = await parseJsonOrThrow(response, 'Music DNA refresh returned an invalid response. Check API base URL.');
      setDNA(data.dna);
      saveCachedDNA(data.dna);
      setError(null);
    } catch (err) {
      const cachedDNA = readCachedDNA();
      if (cachedDNA) {
        setDNA(cachedDNA);
        setError('Music DNA refresh failed, but your cached profile is still available.');
      } else {
        setError(err.message || 'Failed to refresh DNA profile');
      }
      console.error('Error refreshing DNA:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDNA();
  }, [fetchDNA]);

  if (loading) {
    return (
      <div className="dna-profile loading">
        <div className="dna-loading-panel">
          <div className="dna-scanline" />
          <div className="spinner">Analyzing your music fingerprint...</div>
          <p>Reading rhythm, mood, and the trail of tracks you keep coming back to.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dna-profile error">
        <div className="dna-state-panel">
          <div className="offline-banner">{isOffline ? 'Offline mode' : 'Music DNA notice'}</div>
          <div className="error-message">{error}</div>
        </div>
        <div className="dna-actions-row">
          <button onClick={fetchDNA} className="retry-btn">
          Retry
          </button>
          {dna && (
            <button onClick={handleRefreshDNA} className="retry-btn retry-btn--ghost" type="button">
              Refresh
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!dna) {
    return (
      <div className="dna-profile empty">
        <div className="dna-state-panel">
          <p>No DNA data available yet. Play a few tracks to build your profile.</p>
        </div>
      </div>
    );
  }

  const dnaSignals = [
    { label: 'Tracks analyzed', value: String(dna.trackCount || 0), tone: 'aqua' },
    { label: 'Favorite tempo', value: `${dna.tempoAverage || 120} BPM`, tone: 'gold' },
    { label: 'Mood level', value: `${Math.round((dna.valenceAverage || 0.5) * 100)}%`, tone: 'rose' },
    { label: 'Energy level', value: `${Math.round((dna.energyAverage || 0.5) * 100)}%`, tone: 'violet' },
  ];

  return (
    <div className="dna-profile">
      <div className="dna-shell">
        <section className="dna-hero">
          <div className="dna-hero-copy">
            <div className="dna-eyebrow">Music DNA / signal feed</div>
            <h1>Your listening pattern, rendered like an industrial readout.</h1>
            <p className="dna-subtitle">
              Built from {dna.trackCount || 0} tracks. This view shows the shape of your taste, not just a list of stats.
            </p>
            <div className="dna-badges">
              <span className="track-status-pill track-status-pill--downloaded">Offline-first</span>
              <span className="track-status-pill">Cache-aware</span>
              <span className="track-status-pill">Forge mode</span>
            </div>
          </div>

          <div className="dna-hero-card">
            <div className="dna-hero-card-label">Current profile</div>
            <div className="dna-hero-card-value">{getMusicSignature(dna)}</div>
            <div className="dna-hero-card-meta">
              <span>{Math.round((dna.energyAverage || 0.5) * 100)}% energy</span>
              <span>{Math.round((dna.valenceAverage || 0.5) * 100)}% mood</span>
              <span>{Math.round((dna.danceabilityAverage || 0.5) * 100)}% groove</span>
            </div>
          </div>
        </section>

        <div className="dna-header dna-header--controls">
          <button onClick={handleRefreshDNA} className="refresh-btn" type="button">
            Re-scan DNA
          </button>
          <p className="dna-header-note">Re-scans recent plays and rebuilds the sonic profile from the ground up.</p>
        </div>

        <div className="dna-signal-grid">
          {dnaSignals.map((signal) => (
            <div key={signal.label} className={`dna-signal dna-signal--${signal.tone}`}>
              <span className="dna-signal-label">{signal.label}</span>
              <strong className="dna-signal-value">{signal.value}</strong>
            </div>
          ))}
        </div>
      </div>

      <UserDNACard dna={dna} />

      <div className="dna-tabs" role="tablist" aria-label="Music DNA sections">
        <button className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => setActiveTab('overview')} type="button">
          Overview
        </button>
        <button className={`tab-btn ${activeTab === 'genres' ? 'active' : ''}`} onClick={() => setActiveTab('genres')} type="button">
          Genre grid
        </button>
        <button className={`tab-btn ${activeTab === 'twins' ? 'active' : ''}`} onClick={() => setActiveTab('twins')} type="button">
          Sonic Twins
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="dna-section overview">
          <div className="dna-helix-container">
            <div className="dna-panel-title">Helix scan</div>
            <DNAHelix dna={dna} />
          </div>

          <div className="dna-stats dna-stats--stacked">
            <div className="stat">
              <label>Energy Level</label>
              <div className="stat-bar">
                <div 
                  className="stat-fill" 
                  style={{ width: `${(dna.energyAverage || 0.5) * 100}%` }}
                />
              </div>
              <div className="stat-footer">
                <span>{Math.round((dna.energyAverage || 0.5) * 100)}%</span>
                <small>How often your tracks hit with force.</small>
              </div>
            </div>

            <div className="stat">
              <label>Mood (Positivity)</label>
              <div className="stat-bar">
                <div 
                  className="stat-fill mood" 
                  style={{ width: `${(dna.valenceAverage || 0.5) * 100}%` }}
                />
              </div>
              <div className="stat-footer">
                <span>{Math.round((dna.valenceAverage || 0.5) * 100)}%</span>
                <small>Positive versus moody balance.</small>
              </div>
            </div>

            <div className="stat">
              <label>Danceability</label>
              <div className="stat-bar">
                <div 
                  className="stat-fill dance" 
                  style={{ width: `${(dna.danceabilityAverage || 0.5) * 100}%` }}
                />
              </div>
              <div className="stat-footer">
                <span>{Math.round((dna.danceabilityAverage || 0.5) * 100)}%</span>
                <small>How easily your library moves.</small>
              </div>
            </div>

            <div className="stat">
              <label>Acoustic Feel</label>
              <div className="stat-bar">
                <div 
                  className="stat-fill acoustic" 
                  style={{ width: `${(dna.acousticnessAverage || 0.3) * 100}%` }}
                />
              </div>
              <div className="stat-footer">
                <span>{Math.round((dna.acousticnessAverage || 0.3) * 100)}%</span>
                <small>Organic versus synthetic texture.</small>
              </div>
            </div>

            <div className="stat">
              <label>Average Tempo</label>
              <div className="stat-value stat-value--tempo">{dna.tempoAverage || 120} BPM</div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'genres' && (
        <div className="dna-section genres">
          <GenreBreakdown dna={dna} />
        </div>
      )}

      {activeTab === 'twins' && (
        <div className="dna-section twins">
          <SonicTwins />
        </div>
      )}

      <div className="dna-footer">
        <p className="calculated-at">
          Last scan: {new Date(dna.calculatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}

function getMusicSignature(dna) {
  const energy = dna.energyAverage || 0.5;
  const valence = dna.valenceAverage || 0.5;
  const dance = dna.danceabilityAverage || 0.5;

  if (energy > 0.72 && valence > 0.62 && dance > 0.65) return 'High-voltage spark';
  if (energy < 0.34 && valence < 0.45) return 'Night-drive low light';
  if (dance > 0.74) return 'Rhythm-forward pulse';
  if (dna.acousticnessAverage > 0.58) return 'Warm acoustic body';
  return 'Balanced spectrum';
}
