import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/aura_api.dart';
import '../models/track.dart';
import '../state/player_controller.dart';
import '../widgets/track_tile.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final _controller = TextEditingController();
  Future<List<Track>>? _future;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _submit(String q) {
    final query = q.trim();
    if (query.isEmpty) return;
    setState(() => _future = AuraApi.search(query));
  }

  @override
  Widget build(BuildContext context) {
    final player = context.read<PlayerController>();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
      children: [
        Text(
          'Search',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _controller,
          textInputAction: TextInputAction.search,
          onSubmitted: _submit,
          decoration: InputDecoration(
            hintText: 'Songs, artists, albums…',
            prefixIcon: const Icon(Icons.search),
            filled: true,
            fillColor: Colors.white10,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(14),
              borderSide: BorderSide.none,
            ),
          ),
        ),
        const SizedBox(height: 16),
        if (_future == null)
          Text(
            'Type a query and hit search.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
          )
        else
          FutureBuilder<List<Track>>(
            future: _future,
            builder: (context, snap) {
              if (snap.connectionState != ConnectionState.done) {
                return const Padding(
                  padding: EdgeInsets.only(top: 24),
                  child: Center(child: CircularProgressIndicator()),
                );
              }
              final items = snap.data ?? const <Track>[];
              if (items.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.only(top: 24),
                  child: Text(
                    'No results.',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                  ),
                );
              }
              return Column(
                children: [
                  for (final t in items)
                    TrackTile(
                      track: t,
                      onTap: () => player.playTrack(t),
                    ),
                ],
              );
            },
          ),
      ],
    );
  }
}
