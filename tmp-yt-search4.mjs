import { Innertube } from 'youtubei.js';
import fs from 'fs';

(async () => {
    const yt = await Innertube.create();
    const searchResults = await yt.music.search('Deewana Deewana', { type: "song" });
    
    fs.writeFileSync('tmp-songs.json', JSON.stringify({
        songsProperty: searchResults.songs,
        contentsProperty: searchResults.contents
    }, null, 2));
})();
