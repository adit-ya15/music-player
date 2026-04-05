import { Innertube } from 'youtubei.js';

function decodeHtml(value) {
    return String(value || "")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, "\"")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .trim();
}

function pickText(...values) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return decodeHtml(value);
        if (value && typeof value === "object") {
            if (typeof value.text === "string" && value.text.trim()) return decodeHtml(value.text);
            if (typeof value.name === "string" && value.name.trim()) return decodeHtml(value.name);
            if (typeof value.toString === "function") {
                const text = value.toString();
                if (typeof text === "string" && text.trim() && text !== "[object Object]") {
                    return decodeHtml(text);
                }
            }
        }
    }
    return "";
}

function pickArtists(item) {
    const artists = Array.isArray(item?.artists) ? item.artists : [];
    const names = artists
        .map((artist) => ({
            name: pickText(artist?.name, artist?.text, artist),
            id: artist?.channel_id || artist?.id || "",
        }))
        .filter((artist) => artist.name);

    if (names.length) return names;

    const fallback = pickText(item?.artist, item?.author, item?.subtitle);
    return fallback ? [{ name: fallback, id: "" }] : [];
}

function pickArtistName(item) {
    return pickArtists(item).map((artist) => artist.name).filter(Boolean);
}

function pickThumbnailUrl(item) {
    const candidates = [
        ...(Array.isArray(item?.thumbnails) ? item.thumbnails : []),
        ...(Array.isArray(item?.thumbnail) ? item.thumbnail : []),
    ].filter((entry) => entry?.url);
    if (!candidates.length) return "";
    return candidates[0]?.url || "";
}

function parseDuration(text) {
    if (!text) return 0;
    const parts = String(text).split(":").map(Number);
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    return parts[0] || 0;
}

(async () => {
    try {
        const yt = await Innertube.create();
        const searchResults = await yt.music.search('Deewana Deewana', { type: "song" });
        const songs = searchResults.songs?.contents || [];
        
        const results = songs.slice(0, 10).map((song) => ({
            id: song.id,
            title: pickText(song.title, song.name) || "Unknown Title",
            artist: pickArtistName(song).join(", ") || "Unknown Artist",
            artists: pickArtists(song),
            album: pickText(song.album?.name, song.album?.text, song.album),
            duration: parseDuration(song.duration?.text || song.duration),
            durationText: song.duration?.text || "",
            thumbnail: pickThumbnailUrl(song),
            thumbnails: [
                ...(Array.isArray(song.thumbnails) ? song.thumbnails : []),
                ...(Array.isArray(song.thumbnail) ? song.thumbnail : []),
            ],
        }));
        console.log("Success! Results:", results.length);
    } catch (e) {
        console.error("MAP ERROR:", e);
    }
})();
