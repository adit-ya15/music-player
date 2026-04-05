export const parseSyncedLyrics = (rawLyrics = '') => {
  const lines = [];
  let globalOffsetSeconds = 0;

  String(rawLyrics || '')
    .split(/\r?\n/)
    .forEach((rawLine) => {
      const offsetMatch = rawLine.match(/^\[offset:([+-]?\d+)\]$/i);
      if (offsetMatch) {
        const offsetMs = Number(offsetMatch[1] || 0);
        if (Number.isFinite(offsetMs)) globalOffsetSeconds = offsetMs / 1000;
        return;
      }

      const matches = [
        ...rawLine.matchAll(/[\[<](\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?[\]>]/g),
      ];
      const text = rawLine.replace(/\[[^\]]+\]/g, '').trim();
      const normalizedText = text.replace(/<[^>]+>/g, '').trim();

      if (!matches.length || !normalizedText) return;

      for (const match of matches) {
        const minutes = Number(match[1] || 0);
        const seconds = Number(match[2] || 0);
        const fractionRaw = match[3] || '0';
        const fraction = fractionRaw.length === 3
          ? Number(fractionRaw) / 1000
          : Number(fractionRaw) / 100;

        lines.push({
          time: Math.max(0, minutes * 60 + seconds + fraction + globalOffsetSeconds),
          text: normalizedText,
        });
      }
    });

  return lines
    .sort((left, right) => left.time - right.time)
    .filter((line, index, array) => {
      const previous = array[index - 1];
      return !previous || previous.time !== line.time || previous.text !== line.text;
    });
};

export const getActiveLyricIndex = (lines = [], progress = 0) => {
  if (!Array.isArray(lines) || !lines.length) return -1;

  let activeIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    if (progress + 0.15 >= lines[index].time) {
      activeIndex = index;
    } else {
      break;
    }
  }

  return activeIndex;
};
