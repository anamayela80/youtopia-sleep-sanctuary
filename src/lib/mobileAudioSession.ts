type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

export function enableNativePlaybackSession() {
  try {
    const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
    if (audioSession) audioSession.type = "playback";
  } catch {}
}

export function updateMediaSessionPosition(duration: number, position: number, playbackRate = 1) {
  if (!("mediaSession" in navigator)) return;
  if (typeof navigator.mediaSession.setPositionState !== "function") return;
  if (!Number.isFinite(duration) || duration <= 0) return;

  const safePosition = Math.min(Math.max(position, 0), duration);
  try {
    navigator.mediaSession.setPositionState({
      duration,
      position: safePosition,
      playbackRate,
    });
  } catch {}
}