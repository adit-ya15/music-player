import 'package:flutter/material.dart';

import '../api/aura_api.dart';
import '../models/track.dart';

class LyricsSheet extends StatefulWidget {
  final Track track;

  const LyricsSheet({
    super.key,
    required this.track,
  });

  @override
  State<LyricsSheet> createState() => _LyricsSheetState();
}

class _LyricsSheetState extends State<LyricsSheet> {
  late Future<String> _future;

  @override
  void initState() {
    super.initState();
    _future = AuraApi.lyrics(artist: widget.track.artist, title: widget.track.title);
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
          top: 8,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Lyrics', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(
              '${widget.track.title} · ${widget.track.artist}',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 12),
            Flexible(
              child: FutureBuilder<String>(
                future: _future,
                builder: (context, snap) {
                  if (snap.connectionState != ConnectionState.done) {
                    return const Center(child: CircularProgressIndicator());
                  }
                  final lyrics = (snap.data ?? '').trim();
                  if (lyrics.isEmpty) {
                    return const Text('No lyrics found.');
                  }
                  return SingleChildScrollView(
                    child: Text(
                      lyrics,
                      style: Theme.of(context).textTheme.bodyLarge?.copyWith(height: 1.35),
                    ),
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
