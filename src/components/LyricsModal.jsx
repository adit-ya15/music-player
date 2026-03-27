import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { lyricsApi } from '../api/lyrics';
import { saavnApi } from '../api/saavn';
import { usePlayer } from '../context/PlayerContext';
import { getActiveLyricIndex, parseSyncedLyrics } from '../utils/lyrics';

const LyricsModal = ({ isOpen, onClose }) => {
  const { currentTrack, progress } = usePlayer();
  const [lyrics, setLyrics] = useState({ plainLyrics: '', syncedLyrics: '', source: 'none' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const activeLineRef = useRef(null);

  const loadLyrics = useCallback(async () => {
    if (!isOpen || !currentTrack) return;

    setIsLoading(true);
    setError(null);

    try {
      const genericResult = await lyricsApi.getLyricsSafe({
        artist: currentTrack.artist,
        title: currentTrack.title,
        album: currentTrack.album || '',
        duration: currentTrack.duration || 0,
      });

      if (genericResult.ok && genericResult.data) {
        const nextLyrics = {
          plainLyrics: genericResult.data.plainLyrics || '',
          syncedLyrics: genericResult.data.syncedLyrics || '',
          source: genericResult.data.source || 'none',
        };

        if (nextLyrics.plainLyrics || nextLyrics.syncedLyrics) {
          setLyrics(nextLyrics);
          setError(null);
          return;
        }
      }

      if (currentTrack.source === 'saavn') {
        const saavnResult = await saavnApi.getLyricsSafe(currentTrack.id);
        if (saavnResult.ok && saavnResult.data) {
          const cleanLyrics = saavnResult.data.replace(/<br\s*[/]?>/gi, '\n');
          setLyrics({ plainLyrics: cleanLyrics, syncedLyrics: '', source: 'saavn' });
          setError(null);
          return;
        }
      }

      setLyrics({ plainLyrics: '', syncedLyrics: '', source: 'none' });
      setError(genericResult.error || 'No lyrics found for this track.');
    } catch {
      setError('Failed to load lyrics.');
      setLyrics({ plainLyrics: '', syncedLyrics: '', source: 'none' });
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, currentTrack]);

  useEffect(() => {
    loadLyrics();
  }, [loadLyrics]);

  const syncedLines = useMemo(() => parseSyncedLyrics(lyrics.syncedLyrics), [lyrics.syncedLyrics]);
  const activeIndex = useMemo(() => getActiveLyricIndex(syncedLines, progress), [progress, syncedLines]);

  useEffect(() => {
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [activeIndex]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content lyrics-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lyrics-title"
      >
        <div className="modal-header">
          <h2 id="lyrics-title">Lyrics - {currentTrack?.title}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close lyrics" type="button">
            &times;
          </button>
        </div>
        <div className="modal-body lyrics-body">
          {isLoading ? (
            <div className="spinner"></div>
          ) : error ? (
            <div className="lyrics-error-state">
              <p className="error-text">{error}</p>
              <button type="button" className="btn-secondary" onClick={loadLyrics}>
                Retry
              </button>
            </div>
          ) : syncedLines.length > 0 ? (
            <div className="lyrics-synced" role="log" aria-live="polite">
              {syncedLines.map((line, index) => (
                <p
                  key={`${line.time}-${index}`}
                  ref={index === activeIndex ? activeLineRef : null}
                  className={`lyrics-line ${index === activeIndex ? 'lyrics-line--active' : ''}`}
                >
                  {line.text}
                </p>
              ))}
            </div>
          ) : (
            <pre className="lyrics-text">{lyrics.plainLyrics || 'No lyrics found for this track.'}</pre>
          )}
        </div>
      </div>
    </div>
  );
};

export default LyricsModal;

