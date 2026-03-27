import { Capacitor } from '@capacitor/core';
import { MusicPlayer } from '../native/musicPlayer';

const onWeb = (fallback) => Promise.resolve(fallback);

export const nativeMediaApi = {
  getEqualizerState: async () => {
    if (!Capacitor.isNativePlatform()) {
      return onWeb({
        available: false,
        enabled: false,
        currentPreset: 0,
        presets: [],
        message: 'Equalizer is available in the Android app.',
      });
    }

    return await MusicPlayer.getEqualizerState();
  },

  setEqualizerEnabled: async (enabled) => {
    if (!Capacitor.isNativePlatform()) {
      return onWeb({
        available: false,
        enabled: false,
        currentPreset: 0,
        presets: [],
      });
    }

    return await MusicPlayer.setEqualizerEnabled({ enabled });
  },

  setEqualizerPreset: async (preset) => {
    if (!Capacitor.isNativePlatform()) {
      return onWeb({
        available: false,
        enabled: false,
        currentPreset: 0,
        presets: [],
      });
    }

    return await MusicPlayer.setEqualizerPreset({ preset });
  },

  getDownloadedTracks: async () => {
    if (!Capacitor.isNativePlatform()) {
      return { tracks: [], summary: { count: 0, totalBytes: 0 } };
    }

    const result = await MusicPlayer.getDownloadedTracks();
    return {
      tracks: Array.isArray(result?.tracks) ? result.tracks : [],
      summary: result?.summary || { count: 0, totalBytes: 0 },
    };
  },

  downloadTrack: async (track) => {
    if (!Capacitor.isNativePlatform()) {
      return null;
    }

    const result = await MusicPlayer.downloadTrack(track);
    return result?.track || null;
  },

  cancelDownload: async (id) => {
    if (!Capacitor.isNativePlatform()) {
      return { id };
    }

    return await MusicPlayer.cancelDownload({ id });
  },

  deleteDownloadedTrack: async (id) => {
    if (!Capacitor.isNativePlatform()) {
      return { deleted: false, summary: { count: 0, totalBytes: 0 } };
    }

    return await MusicPlayer.deleteDownloadedTrack({ id });
  },

  onDownloadProgress: (listener) => {
    if (!Capacitor.isNativePlatform()) {
      return { remove: async () => {} };
    }

    return MusicPlayer.addListener('downloadProgress', listener);
  },

  onDownloadCompleted: (listener) => {
    if (!Capacitor.isNativePlatform()) {
      return { remove: async () => {} };
    }

    return MusicPlayer.addListener('downloadCompleted', listener);
  },

  onDownloadFailed: (listener) => {
    if (!Capacitor.isNativePlatform()) {
      return { remove: async () => {} };
    }

    return MusicPlayer.addListener('downloadFailed', listener);
  },
};
