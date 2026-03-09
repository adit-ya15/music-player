useEffect(() => {
  // ... (keep the nextTrack/prevTrack listeners here)

  // Listen for progress updates from the native player
  const statusListener = MusicPlayer.addListener('statusUpdate', (data