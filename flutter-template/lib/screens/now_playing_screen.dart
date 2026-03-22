import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/aura_api.dart';
import '../models/track.dart';
import '../state/player_controller.dart';
import '../widgets/lyrics_sheet.dart';
import '../widgets/queue_sheet.dart';

class NowPlayingScreen extends StatelessWidget {
  const NowPlayingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = context.watch<PlayerController>();
    final track = controller.current;

    if (track == null) {
      return const Scaffold(
        body: SafeArea(
          child: Center(child: Text('Nothing playing')),
        ),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Now Playing'),
        centerTitle: true,
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            children: [
              _Artwork(track: track),
              const SizedBox(height: 16),
              Text(
                track.title,
                style: Theme.of(context).textTheme.titleLarge,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 6),
              Text(
                track.artist,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white70),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 16),
              StreamBuilder<Duration?>(
                stream: controller.durationStream,
                builder: (context, durSnap) {
                  final duration = durSnap.data ?? Duration.zero;
                  return StreamBuilder<Duration>(
                    stream: controller.positionStream,
                    builder: (context, posSnap) {
                      final pos = posSnap.data ?? Duration.zero;
                      final max = duration.inMilliseconds > 0 ? duration : const Duration(milliseconds: 1);
                      final value = pos.inMilliseconds.clamp(0, max.inMilliseconds).toDouble();

                      return Column(
                        children: [
                          Slider(
                            value: value,
                            min: 0,
                            max: max.inMilliseconds.toDouble(),
                            onChanged: (v) => controller.seek(Duration(milliseconds: v.toInt())),
                          ),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(_fmt(pos), style: const TextStyle(color: Colors.white70)),
                              Text(_fmt(duration), style: const TextStyle(color: Colors.white70)),
                            ],
                          ),
                        ],
                      );
                    },
                  );
                },
              ),
              const SizedBox(height: 8),
              StreamBuilder(
                stream: controller.playerStateStream,
                builder: (context, _) {
                  final playing = controller.audio.playing;
                  final loading = controller.isLoading || controller.audio.processingState == ProcessingState.loading;

                  return Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      IconButton(
                        onPressed: loading
                            ? null
                            : () async {
                                await showModalBottomSheet(
                                  context: context,
                                  showDragHandle: true,
                                  isScrollControlled: true,
                                  builder: (_) => QueueSheet(videoId: track.id),
                                );
                              },
                        icon: const Icon(Icons.queue_music),
                        tooltip: 'Queue',
                      ),
                      const SizedBox(width: 8),
                      FilledButton.tonalIcon(
                        onPressed: loading ? null : controller.togglePlayPause,
                        icon: Icon(playing ? Icons.pause : Icons.play_arrow),
                        label: Text(playing ? 'Pause' : 'Play'),
                      ),
                      const SizedBox(width: 8),
                      IconButton(
                        onPressed: loading
                            ? null
                            : () async {
                                await showModalBottomSheet(
                                  context: context,
                                  showDragHandle: true,
                                  isScrollControlled: true,
                                  builder: (_) => LyricsSheet(track: track),
                                );
                              },
                        icon: const Icon(Icons.lyrics_outlined),
                        tooltip: 'Lyrics',
                      ),
                    ],
                  );
                },
              ),
              const Spacer(),
              Text(
                'Backend: ${AuraApi.baseUrl}',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.white38),
              ),
            ],
          ),
        ),
      ),
    );
  }

  static String _fmt(Duration d) {
    final s = d.inSeconds;
    final mm = (s ~/ 60).toString().padLeft(2, '0');
    final ss = (s % 60).toString().padLeft(2, '0');
    return '$mm:$ss';
  }
}

class _Artwork extends StatelessWidget {
  final Track track;
  const _Artwork({required this.track});

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final dim = size.width.clamp(240, 420).toDouble();

    return Center(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(18),
        child: Container(
          width: dim,
          height: dim,
          color: Colors.white10,
          child: track.thumbnail.isEmpty
              ? const Icon(Icons.music_note, size: 96)
              : Image.network(
                  track.thumbnail,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const Icon(Icons.music_note, size: 96),
                ),
        ),
      ),
    );
  }
}
