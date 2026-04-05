import { Innertube } from 'youtubei.js';

(async () => {
    const yt = await Innertube.create();
    const searchResults = await yt.music.search('Deewana Deewana', { type: "song" });
    console.log(JSON.stringify(searchResults, null, 2));
})();
