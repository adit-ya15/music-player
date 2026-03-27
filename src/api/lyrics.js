import axios from 'axios';
import { friendlyErrorMessage, logError } from '../utils/logger';
import { API_BASE } from './apiBase';

export const lyricsApi = {
  getLyricsSafe: async ({ artist, title, album = '', duration = 0 }) => {
    try {
      const response = await axios.get(`${API_BASE}/lyrics`, {
        params: { artist, title, album, duration },
        timeout: 10000,
      });

      return {
        ok: true,
        data: response?.data || null,
        error: null,
      };
    } catch (error) {
      logError('lyrics.getLyrics', error, { artist, title });
      return {
        ok: false,
        data: null,
        error: friendlyErrorMessage(error, 'Lyrics could not be loaded right now.'),
      };
    }
  },
};
