import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'screens/home_shell.dart';
import 'state/player_controller.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const NullApp());
}

class NullApp extends StatelessWidget {
  const NullApp({super.key});

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
        title: 'Null',
        theme: theme,
        home: const HomeShell(),
      ),
    );
  }
}
