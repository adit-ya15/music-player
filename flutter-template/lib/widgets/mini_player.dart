import 'package:flutter/material.dart';

import '../state/player_controller.dart';
import '../screens/now_playing_screen.dart';

class MiniPlayer extends StatelessWidget {
  final PlayerController controller;

  const MiniPlayer({
    super.key,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    final track = controller.current;
    if (track == null) return const SizedBox.shrink();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const NowPlayingScreen()),
          );
        },
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.55),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.white10),
          ),
          child: Row(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: track.thumbnail.isEmpty
                    ? Container(
                        width: 46,
                        height: 46,
                        color: Colors.white10,
                        child: const Icon(Icons.music_note),
                      )
                    : Image.network(
                        track.thumbnail,
                        width: 46,
                        height: 46,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(
                          width: 46,
                          height: 46,
                          color: Colors.white10,
                          child: const Icon(Icons.music_note),
                        ),
                      ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      track.title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleSmall,
                    ),
                    Text(
                      track.artist,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.white70),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              StreamBuilder(
                stream: controller.playerStateStream,
                builder: (context, _) {
                  final loading = controller.isLoading;
                  final playing = controller.audio.playing;

                  if (loading) {
                    return const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    );
                  }

                  return IconButton(
                    onPressed: controller.togglePlayPause,
                    icon: Icon(playing ? Icons.pause : Icons.play_arrow),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
