import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:just_audio/just_audio.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/aura_api.dart';
import '../models/track.dart';

class PlayerController extends ChangeNotifier {
  final AudioPlayer _player = AudioPlayer();

  Track? _current;
  List<Track> _queue = const [];
  bool _loading = false;
  String? _lastError;

  Track? get current => _current;
  List<Track> get queue => _queue;
  bool get isLoading => _loading;
  String? get lastError => _lastError;

  AudioPlayer get audio => _player;

  Stream<Duration> get positionStream => _player.positionStream;
  Stream<Duration?> get durationStream => _player.durationStream;
  Stream<PlayerState> get playerStateStream => _player.playerStateStream;

  Future<void> disposeAsync() async {
    await _player.dispose();
  }

  @override
  void dispose() {
    // best-effort
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> playTrack(Track track, {List<Track>? seedQueue}) async {
    _loading = true;
    _lastError = null;
    notifyListeners();

    try {
      _current = track;

      // Resolve a direct stream URL (preferred). If it fails, fall back to backend pipe endpoint.
      final direct = await AuraApi.streamUrl(track);
      final uri = direct != null ? Uri.parse(direct) : AuraApi.pipeUrl(track.id);

      await _player.setAudioSource(
        AudioSource.uri(
          uri,
          headers: const {
            'User-Agent': 'Mozilla/5.0',
          },
        ),
      );

      await _player.play();

      if (seedQueue != null) {
        _queue = seedQueue;
      } else {
        // Keep queue minimal: fetch "Up Next" in the background.
        unawaited(_refreshQueue(track.id));
      }

      unawaited(_addToRecents(track));
    } catch (e) {
      _lastError = e.toString();
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> togglePlayPause() async {
    if (_player.playing) {
      await _player.pause();
    } else {
      await _player.play();
    }
    notifyListeners();
  }

  Future<void> seek(Duration position) async {
    await _player.seek(position);
  }

  Future<void> playNext(Track next) async {
    await playTrack(next);
  }

  Future<void> _refreshQueue(String videoId) async {
    try {
      final items = await AuraApi.upNext(videoId);
      _queue = items;
      notifyListeners();
    } catch {
      // ignore
    }
  }

  static const _recentsKey = 'recents_v1';

  Future<void> _addToRecents(Track track) async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_recentsKey) ?? <String>[];

    // store as compact JSON string
    final encoded = jsonEncode(track.toJson());

    final next = <String>[encoded, ...list.where((e) => e != encoded)];
    if (next.length > 30) next.removeRange(30, next.length);

    await prefs.setStringList(_recentsKey, next);
  }

  Future<List<Track>> loadRecents() async {
    final prefs = await SharedPreferences.getInstance();
    final list = prefs.getStringList(_recentsKey) ?? <String>[];
    final tracks = <Track>[];

    for (final item in list) {
      try {
        final map = jsonDecode(item);
        if (map is Map<String, dynamic>) {
          tracks.add(Track.fromJson(map));
        }
      } catch {
        // ignore
      }
    }

    return tracks;
  }
}
