class Track {
  final String id;
  final String title;
  final String artist;
  final String album;
  final String thumbnail;
  final int? durationSeconds;

  const Track({
    required this.id,
    required this.title,
    required this.artist,
    required this.album,
    required this.thumbnail,
    this.durationSeconds,
  });

  factory Track.fromJson(Map<String, dynamic> json) {
    return Track(
      id: (json['id'] ?? '').toString(),
      title: (json['title'] ?? 'Unknown').toString(),
      artist: (json['artist'] ?? 'Unknown').toString(),
      album: (json['album'] ?? 'YouTube Music').toString(),
      thumbnail: (json['thumbnail'] ?? '').toString(),
      durationSeconds: json['duration'] is int ? (json['duration'] as int) : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'artist': artist,
      'album': album,
      'thumbnail': thumbnail,
      'duration': durationSeconds,
    };
  }
}
