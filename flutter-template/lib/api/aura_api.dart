import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/track.dart';

class AuraApi {
  // For Android emulator: 10.0.2.2 maps to host machine.
  // Override at build-time: flutter run --dart-define=AURA_BASE_URL=http://<ip>:3001
  static const String baseUrl = String.fromEnvironment(
    'AURA_BASE_URL',
    defaultValue: 'http://10.0.2.2:3001',
  );

  static Uri _uri(String path, [Map<String, String>? query]) {
    return Uri.parse(baseUrl).replace(
      path: path.startsWith('/') ? path : '/$path',
      queryParameters: query,
    );
  }

  static Future<List<Track>> trending() async {
    final r = await http.get(_uri('/api/yt/trending'));
    if (r.statusCode != 200) return const [];
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    final items = (data['results'] as List? ?? const []).cast<dynamic>();
    return items
        .map((e) => Track.fromJson((e as Map).cast<String, dynamic>()))
        .where((t) => t.id.isNotEmpty)
        .toList(growable: false);
  }

  static Future<List<Track>> search(String query, {int limit = 20}) async {
    final r = await http.get(_uri('/api/yt/search', {
      'query': query,
      'limit': limit.toString(),
    }));
    if (r.statusCode != 200) return const [];
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    final items = (data['results'] as List? ?? const []).cast<dynamic>();
    return items
        .map((e) => Track.fromJson((e as Map).cast<String, dynamic>()))
        .where((t) => t.id.isNotEmpty)
        .toList(growable: false);
  }

  static Future<String?> streamUrl(Track track) async {
    final r = await http.get(_uri('/api/yt/stream/${track.id}', {
      'title': track.title,
      'artist': track.artist
    }));
    if (r.statusCode != 200) return null;
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    final url = (data['streamUrl'] ?? '').toString().trim();
    return url.isEmpty ? null : url;
  }

  static Uri pipeUrl(String videoId) => _uri('/api/yt/pipe/$videoId');

  static Future<List<Track>> upNext(String videoId) async {
    final r = await http.get(_uri('/api/yt/up-next/$videoId'));
    if (r.statusCode != 200) return const [];
    final data = jsonDecode(r.body) as Map<String, dynamic>;
    final items = (data['results'] as List? ?? const []).cast<dynamic>();
    return items
        .map((e) => Track.fromJson((e as Map).cast<String, dynamic>()))
        .where((t) => t.id.isNotEmpty)
        .toList(growable: false);
  }

  static Future<String> lyrics({required String artist, required String title}) async {
    final r = await http.get(_uri('/api/yt/lyrics', {
      'artist': artist,
      'title': title,
    }));
    if (r.statusCode != 200) return '';
    final data = jsonDecode(r.body);
    if (data is Map<String, dynamic>) {
      return (data['lyrics'] ?? '').toString();
    }
    return '';
  }
}
