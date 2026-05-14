type NavigatorWithAudioSession = Navigator & {
  audioSession?: { type: string };
};

export function enableNativePlaybackSession() {
  try {
    const audioSession = (navigator as NavigatorWithAudioSession).audioSession;
    if (audioSession) audioSession.type = "playback";
  } catch {}
}

// ---------------------------------------------------------------------------
// Silent audio keepalive
// ---------------------------------------------------------------------------
// iOS suspends AudioContext when the screen locks — UNLESS there is an active
// <audio> element playing. This 1-sample silent WAV loops forever at near-zero
// volume. It is completely inaudible but keeps the iOS media session alive,
// which prevents AudioContext from being suspended on screen lock.
// This means everything routed through Web Audio (voice, seeds, reverb,
// ducking) keeps playing exactly as if the screen were on.
//
// Must be started inside a user-gesture handler (the play button tap).
// ---------------------------------------------------------------------------
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

let keepAliveEl: HTMLAudioElement | null = null;

export function startAudioKeepalive() {
  if (keepAliveEl) return; // already running
  keepAliveEl = new Audio(SILENT_WAV);
  keepAliveEl.loop = true;
  keepAliveEl.volume = 0.001; // inaudible — this is purely to keep iOS audio session alive
  keepAliveEl.play().catch(() => {});
}

export function stopAudioKeepalive() {
  keepAliveEl?.pause();
  keepAliveEl = null;
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