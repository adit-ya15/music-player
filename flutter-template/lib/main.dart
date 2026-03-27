import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_shell.dart';
import 'state/player_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const AuraMusicApp());
}

class AuraMusicApp extends StatelessWidget {
  const AuraMusicApp({super.key});

  @override
  Widget build(BuildContext context) {
    final theme = ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      colorScheme: ColorScheme.fromSeed(
        seedColor: const Color(0xFFFF2D55),
        brightness: Brightness.dark,
      ),
    );

    return ChangeNotifierProvider(
      create: (_) => PlayerController(),
      child: MaterialApp(
        title: 'Aura Music',
        theme: theme,
        home: const HomeShell(),
      ),
    );
  }
}
