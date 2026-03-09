/* eslint-disable react-refresh/only-export-components */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef
} from "react";

import { registerPlugin } from "@capacitor/core";
import { getColor } from "colorthief";

import { youtubeApi } from "../api/youtube";
import { saavnApi } from "../api/saavn";

import {
  buildPlaybackSession,
  cycleSleepTimerValue,
  getNextListIndex,
  getPreviousQueueIndex,
  parseStoredSession,
  serializeSession
} from "../utils/playerState";

const MusicPlayer = registerPlugin("MusicPlayer");

const PlayerContext = createContext();

const FALLBACK_COVER =
  "https://placehold.co/500x500/27272a/71717a?text=%E2%99%AA";

export const usePlayer = () => useContext(PlayerContext);

export const PlayerProvider = ({ children }) => {

  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const [queue, setQueue] = useState([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [queueMode, setQueueMode] = useState("list");

  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState("off");

  const [isLoading, setIsLoading] = useState(false);
  const [dominantColor, setDominantColor] = useState("rgba(15,15,19,1)");

  const [autoRadioEnabled, setAutoRadioEnabled] = useState(true);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState(null);

  const radioHistoryRef = useRef(new Set());
  const sleepTimerRef = useRef(null);

  /* -------------------------- PLAY TRACK -------------------------- */

  const loadAndPlay = useCallback(async (track) => {

    if (!track) return;

    setIsLoading(true);
    setCurrentTrack(track);

    try {

      let streamUrl = track.streamUrl;

      if (track.source === "youtube" && !streamUrl) {

        const videoId = track.videoId || track.id.replace(/^yt-/, "");

        const details = await youtubeApi.getStreamDetails(videoId);

        if (!details?.streamUrl) {
          throw new Error("Stream fetch failed");
        }

        streamUrl = details.streamUrl;
      }

      await MusicPlayer.play({
        url: streamUrl,
        title: track.title,
        artist: track.artist,
        artwork: track.coverArt || FALLBACK_COVER
      });

      setIsPlaying(true);

    } catch (error) {

      console.error("Playback error", error);

    } finally {

      setIsLoading(false);

    }

  }, []);

  /* -------------------------- PLAY SESSION -------------------------- */

  const playTrack = useCallback((track, trackList, options = {}) => {

    if (!track) return;

    const session = buildPlaybackSession({
      track,
      trackList,
      mode: options.mode
    });

    setQueueMode(session.queueMode);
    setQueue(session.queue);
    setQueueIndex(session.queueIndex);

    if (session.queueMode === "radio") {
      radioHistoryRef.current = new Set([track.id]);
    }

    loadAndPlay(track);

  }, [loadAndPlay]);

  /* -------------------------- TOGGLE PLAY -------------------------- */

  const togglePlay = useCallback(async () => {

    if (!currentTrack) return;

    if (isPlaying) {

      await MusicPlayer.pause();
      setIsPlaying(false);

    } else {

      await MusicPlayer.resume();
      setIsPlaying(true);

    }

  }, [isPlaying, currentTrack]);

  /* -------------------------- NEXT TRACK -------------------------- */

  const skipNext = useCallback(async () => {

    if (!queue.length) return;

    let nextIndex;

    if (shuffleMode) {

      nextIndex = Math.floor(Math.random() * queue.length);

    } else {

      nextIndex = getNextListIndex({
        queueIndex,
        queueLength: queue.length,
        repeatMode
      });

    }

    if (nextIndex == null) return;

    setQueueIndex(nextIndex);
    loadAndPlay(queue[nextIndex]);

  }, [queue, queueIndex, shuffleMode, repeatMode, loadAndPlay]);

  /* -------------------------- PREVIOUS -------------------------- */

  const skipPrev = useCallback(async () => {

    if (!queue.length) return;

    const prevIndex = getPreviousQueueIndex({
      queueIndex,
      queueLength: queue.length,
      queueMode,
      repeatMode
    });

    if (prevIndex == null) return;

    setQueueIndex(prevIndex);
    loadAndPlay(queue[prevIndex]);

  }, [queue, queueIndex, queueMode, repeatMode, loadAndPlay]);

  /* -------------------------- SEEK -------------------------- */

  const seekTo = useCallback(async (time) => {

    await MusicPlayer.seek({ position: time });
    setProgress(time);

  }, []);

  /* -------------------------- SHUFFLE -------------------------- */

  const toggleShuffle = useCallback(() => {

    setShuffleMode(v => !v);

  }, []);

  /* -------------------------- REPEAT -------------------------- */

  const cycleRepeat = useCallback(() => {

    setRepeatMode(v =>
      v === "off" ? "all" : v === "all" ? "one" : "off"
    );

  }, []);

  /* -------------------------- AUTO RADIO -------------------------- */

  const toggleAutoRadio = useCallback(() => {

    setAutoRadioEnabled(v => !v);

  }, []);

  /* -------------------------- SLEEP TIMER -------------------------- */

  const cycleSleepTimer = useCallback(() => {

    setSleepTimerMinutes(prev => {

      const next = cycleSleepTimerValue(prev);

      if (sleepTimerRef.current) {
        clearTimeout(sleepTimerRef.current);
      }

      if (next != null) {

        sleepTimerRef.current = setTimeout(async () => {

          await MusicPlayer.pause();
          setIsPlaying(false);

        }, next * 60 * 1000);

      }

      return next;

    });

  }, []);

  /* -------------------------- DOMINANT COLOR -------------------------- */

  useEffect(() => {

    if (!currentTrack?.coverArt) {
      setDominantColor("rgba(15,15,19,1)");
      return;
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";

    img.onload = async () => {

      try {

        const color = await getColor(img);

        if (Array.isArray(color)) {
          setDominantColor(`rgb(${color[0]},${color[1]},${color[2]})`);
        }

      } catch {
        setDominantColor("rgba(15,15,19,1)");
      }

    };

    img.src = currentTrack.coverArt;

  }, [currentTrack]);

  /* -------------------------- SESSION STORAGE -------------------------- */

  useEffect(() => {

    try {

      localStorage.setItem(
        "aura-player-session",
        serializeSession({
          queue,
          queueIndex,
          currentTrack
        })
      );

    } catch { }

  }, [queue, queueIndex, currentTrack]);

  useEffect(() => {

    const saved = parseStoredSession(
      localStorage.getItem("aura-player-session")
    );

    if (!saved) return;

    setQueue(saved.queue);
    setQueueIndex(saved.queueIndex);
    setCurrentTrack(saved.currentTrack);

  }, []);

  /* -------------------------- LOCK SCREEN CONTROLS -------------------------- */

  useEffect(() => {
    // Listen for 'nextTrack' event from Android Lockscreen or when a song ends
    const nextListener = MusicPlayer.addListener('nextTrack', () => {
      skipNext();
    });

    // Listen for 'prevTrack' event from Android Lockscreen
    const prevListener = MusicPlayer.addListener('prevTrack', () => {
      skipPrev();
    });

    // Listen for progress updates from the native player
    const statusListener = MusicPlayer.addListener('statusUpdate', (data) => {
      if (data.position != null) {
        setProgress(data.position);
      }
      if (data.duration != null) {
        setDuration(data.duration);
      }
    });

    return () => {
      nextListener.remove();
      prevListener.remove();
      statusListener.remove();
    };
  }, [skipNext, skipPrev]);

  /* -------------------------- CONTEXT VALUE -------------------------- */

  const value = {

    currentTrack,
    isPlaying,
    progress,
    duration,

    queue,
    queueIndex,
    queueMode,

    shuffleMode,
    repeatMode,

    dominantColor,
    isLoading,

    autoRadioEnabled,
    sleepTimerMinutes,

    playTrack,
    togglePlay,
    skipNext,
    skipPrev,
    seekTo,

    toggleShuffle,
    cycleRepeat,
    toggleAutoRadio,

    cycleSleepTimer,
    setQueue

  };

  return (
    <PlayerContext.Provider value={value}>
      {children}
    </PlayerContext.Provider>
  );

};