import { Innertube } from 'youtubei.js';

(async () => {
    const yt = await Innertube.create();
    const searchResults = await yt.music.search('Deewana Deewana', { type: "song" });
    console.log("type of songs:", typeof searchResults.songs);
    console.log("is array:", Array.isArray(searchResults.songs));
    console.log("has contents:", 'contents' in (searchResults.songs || {}));
    if (searchResults.songs) {
        console.log("songs properties:", Object.keys(searchResults.songs));
    }
})();
