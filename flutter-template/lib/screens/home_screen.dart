import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/aura_api.dart';
import '../models/track.dart';
import '../state/player_controller.dart';
import '../widgets/track_tile.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late Future<List<Track>> _future;

  @override
  void initState() {
    super.initState();
    _future = AuraApi.trending();
  }

  @override
  Widget build(BuildContext context) {
    final controller = context.read<PlayerController>();

    return RefreshIndicator(
      onRefresh: () async {
        setState(() => _future = AuraApi.trending());
        await _future;
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Text(
            'Home',
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 8),
          Text(
            'Trending right now',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(color: Colors.white70),
          ),
          const SizedBox(height: 16),
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
                    'No items. Check backend at ${AuraApi.baseUrl}',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.white70),
                  ),
                );
              }
              return Column(
                children: [
                  for (final t in items)
                    TrackTile(
                      track: t,
                      onTap: () => controller.playTrack(t),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
