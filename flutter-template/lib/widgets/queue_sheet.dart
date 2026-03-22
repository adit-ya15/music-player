import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/aura_api.dart';
import '../models/track.dart';
import '../state/player_controller.dart';

class QueueSheet extends StatefulWidget {
  final String videoId;
  const QueueSheet({
    super.key,
    required this.videoId,
  });

  @override
  State<QueueSheet> createState() => _QueueSheetState();
}

class _QueueSheetState extends State<QueueSheet> {
  late Future<List<Track>> _future;

  @override
  void initState() {
    super.initState();
    _future = AuraApi.upNext(widget.videoId);
  }

  @override
  Widget build(BuildContext context) {
    final player = context.read<PlayerController>();

    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Up Next', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Flexible(
              child: FutureBuilder<List<Track>>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final items = snap.data ?? const <Track>[];
                  if (items.isEmpty) {
                    return const Text('Nothing queued.');
                  }

                  return ListView.separated(
                    itemCount: items.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, color: Colors.white12),
                    itemBuilder: (context, i) {
                      final t = items[i];
                      return ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: t.thumbnail.isEmpty
                              ? Container(width: 44, height: 44, color: Colors.white10, child: const Icon(Icons.music_note))
                              : Image.network(
                                  t.thumbnail,
                                  width: 44,
                                  height: 44,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => Container(
                                    width: 44,
                                    height: 44,
                                    color: Colors.white10,
                                    child: const Icon(Icons.music_note),
                                  ),
                                ),
                        ),
                        title: Text(t.title, maxLines: 1, overflow: TextOverflow.ellipsis),
                        subtitle: Text(t.artist, maxLines: 1, overflow: TextOverflow.ellipsis),
                        onTap: () async {
                          Navigator.of(context).pop();
                          await player.playNext(t);
                        },
                      );
                    },
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
