import PQueue from 'p-queue';

const concurrency = Math.max(1, Number(process.env.YTDLP_CONCURRENCY || 2));

export const ytdlpQueue = new PQueue({
  concurrency,
});
