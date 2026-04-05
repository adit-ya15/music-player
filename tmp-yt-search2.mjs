import { Innertube } from 'youtubei.js';

(async () => {
    const yt = await Innertube.create();
    const searchResults = await yt.music.search('Deewana Deewana', { type: "song" });
    console.log(Object.keys(searchResults));
    console.log(searchResults.songs ? 'HAS SONGS' : 'NO SONGS');
    console.log(searchResults.contents ? 'HAS CONTENTS' : 'NO CONTENTS');
})();
