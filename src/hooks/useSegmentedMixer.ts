import { useRef, useState, useCallback, useEffect } from "react";
import { createReverb, createVoiceBus } from "@/lib/audioEffects";
import {
  TENURE_TIMING as SESSION_TIMING,
  DUCK_RATIO,
  DUCK_PRE_RAMP,
  DUCK_POST_RAMP,
  VOICE_RATE,
  VOICE_WET,
  VOICE_LPF,
  MUSIC_RAMP_SECS,
  ARC,
} from "@/lib/sessionTiming";
import { enableNativePlaybackSession, updateMediaSessionPosition, startAudioKeepalive, stopAudioKeepalive } from "@/lib/mobileAudioSession";

/**
 * Segmented meditation mixer: 5 narration segments spaced over music bridges.
 *
 * This is the evening / full-length format: ~20 min total with long musical
 * silences between segments so each section can LAND before the next begins.
 *
 * Design principles:
 *   - Music ducks per-segment — drops under each voice segment, rises between.
 *   - Voice shares the music's reverb for cohesion.
 *   - Music follows an emotional arc: soft fade-in, builds through segment 3
 *     (the vision/heart), resolves in segment 4.
 *   - Voice playback rate 0.98 adds breathing room.
 */

interface UseSegmentedMixerOptions {
  segmentUrls: string[];
  musicUrl: string | null;
  musicBridgeDurations?: number[];
  musicFadeInDuration?: number;
  musicFadeOutDuration?: number;
  /** Peak music level (reached during segment 3). Default 0.42 */
  musicVolume?: number;
  /** Voice dry level. Default 0.72 — high enough to clearly lead */
  narrationVolume?: number;
  /**
   * Tenure band — when provided and bridge/fade durations aren't explicitly
   * set, the mixer scales silences to match the corresponding session length.
   */
  tenureBand?: "orienting" | "settling" | "established";
}

/**
 * Tenure-aware defaults so the music breathing room scales with the listener's
 * journey — the same 4-segment audio structure is stretched into longer
 * sessions as users become established.
 *
 *   orienting   → ~20 min (fade 60 + bridges 135/150/135 + fade 120)
 *   settling    → ~28 min (fade 75 + bridges 180/210/180 + fade 150)
 *   established → ~38 min (fade 90 + bridges 240/300/240 + fade 180)
 */
/**
 * Bridge durations are the primary lever for session length.
 * Dot-based pauses in the TTS audio only contribute ~6-8 s per marker;
 * the real silence that lets each section LAND comes from these bridges.
 *
 *   orienting   → ~20 min  (5 min narration + 15 min music/silence)
 *   settling    → ~28 min  (7 min narration + 21 min music/silence)
 *   established → ~38 min  (9 min narration + 29 min music/silence)
 */
/**
 * Bridge timing notes (6 segments, 5 active bridges):
 *   Bridge 0 = 0     (no gap before segment 1 — fadeIn handles the opening)
 *   Bridge 1         (after Arrival/Heart/Energy, before Deep Release)
 *   Bridge 2         (after Deep Release, before Space of Nowhere — longest drop)
 *   Bridge 3         (after Space of Nowhere, before Vision A — listener emerges
 *                     from formlessness, needs a clear threshold before images)
 *   Bridge 4         (after Vision A, before Vision B — short breath between
 *                     image groups, keeps the dream state without breaking it)
 *   Bridge 5         (after Vision B / Remember, before Anchor + Return)
 *   FadeOut          (brief — don't hold in music after "open your eyes")
 */
// Bridge timing targets.
// Orienting targets ≥20 min: 14 min structure + ~6-7 min narration.
// Bridge 2 (after Softening, before Dissolution) is the biggest breathing
// space — the long musical moment before the formlessness section.
// FadeOut = 90s so the Return doesn't feel cut off.
// TENURE_TIMING is imported from lib/sessionTiming.ts as SESSION_TIMING.

/** Which section's arc-level applies at a given session time. Module-scope so it isn't recreated each render. */
function arcLevelAt(sessionTime: number, events: { startOffset: number; duration: number }[]): number {
  if (events.length === 0) return ARC.fadeInPeak;
  if (sessionTime < (events[0]?.startOffset ?? Infinity)) return ARC.fadeInPeak;
  if (sessionTime < (events[1]?.startOffset ?? Infinity)) return ARC.fadeInPeak;
  if (sessionTime < (events[2]?.startOffset ?? Infinity)) return ARC.section2;
  const returnSeg = events[events.length - 1];
  if (returnSeg && sessionTime >= returnSeg.startOffset) return ARC.section4;
  return ARC.section3;
}

// Ducking, voice, and arc constants are imported from lib/sessionTiming.ts
// to stay in sync with the offline renderer. Do not redeclare them here.

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch audio (${resp.status}): ${url}`);
  const arrayBuf = await resp.arrayBuffer();
  return ctx.decodeAudioData(arrayBuf);
}

// Smoothly animate an <audio> element's volume over durationMs.
function fadeVol(el: HTMLAudioElement, targetVol: number, durationMs: number) {
  const startVol = el.volume;
  const target = Math.max(0, Math.min(1, targetVol));
  const startTime = performance.now();
  const step = () => {
    const t = Math.min((performance.now() - startTime) / durationMs, 1);
    el.volume = startVol + (target - startVol) * t;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function useSegmentedMixer({
  segmentUrls,
  musicUrl,
  musicBridgeDurations,
  musicFadeInDuration,
  musicFadeOutDuration,
  musicVolume = 0.55,
  narrationVolume = 0.72,
  tenureBand,
}: UseSegmentedMixerOptions) {
  // Resolve tenure-aware defaults when explicit timings aren't passed.
  const tenureDefaults = SESSION_TIMING[tenureBand ?? "orienting"];
  const resolvedBridges = musicBridgeDurations ?? tenureDefaults.bridges;
  const resolvedFadeIn = musicFadeInDuration ?? tenureDefaults.fadeIn;
  const resolvedFadeOut = musicFadeOutDuration ?? tenureDefaults.fadeOut;
  const audioCtxRef = useRef<AudioContext | null>(null);
  const segmentBuffersRef = useRef<AudioBuffer[]>([]);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const musicElementRef = useRef<HTMLAudioElement | null>(null);
  const duckTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const totalDurationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const tickRef = useRef<(() => void) | null>(null);
  const pauseRef = useRef<(() => void) | null>(null);
  const resumeRef = useRef<(() => void) | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const getPlaybackPosition = useCallback((ctx: AudioContext | null = audioCtxRef.current) => {
    const total = totalDurationRef.current;
    const elapsed = isPlayingRef.current && ctx
      ? offsetRef.current + Math.max(0, ctx.currentTime - startTimeRef.current)
      : offsetRef.current;
    return Math.min(Math.max(elapsed, 0), total || Math.max(elapsed, 0));
  }, []);

  /**
   * Build the full timeline with each segment's start/end in session seconds,
   * accounting for the slowed playback rate on narration buffers.
   */
  const buildTimeline = useCallback(() => {
    const buffers = segmentBuffersRef.current;
    const events: { index: number; startOffset: number; duration: number }[] = [];
    let t = resolvedFadeIn;
    buffers.forEach((buf, i) => {
      const effectiveDuration = buf.duration / VOICE_RATE;
      events.push({ index: i, startOffset: t, duration: effectiveDuration });
      t += effectiveDuration;
      if (i < buffers.length - 1) t += resolvedBridges[i + 1] || 60;
    });
    const naturalEnd = t + resolvedFadeOut;
    // Guarantee minimum session length per tenure band.
    // If narration audio runs short, the extra time is absorbed into the fade-out
    // so the session always feels complete, never abruptly ended.
    const minDuration = tenureBand === "established" ? 38 * 60
                      : tenureBand === "settling"    ? 28 * 60
                      :                                20 * 60; // orienting default
    const totalDuration = Math.max(naturalEnd, minDuration);
    return { events, totalDuration };
  }, [resolvedFadeIn, resolvedFadeOut, resolvedBridges, tenureBand]);

  // Cleanup only — audio loads lazily when the user taps play, not on mount.
  // Auto-loading on mount decoded 300–400 MB of PCM into memory immediately,
  // which crashes Safari on iOS even before the user touches anything.
  useEffect(() => {
    return () => {
      stopAll();
      audioCtxRef.current?.close();
    };
  }, []);

  /** Register MediaSession so the OS knows we're playing audio. Without this,
   *  iOS/Android suspend the AudioContext when the screen locks. */
  const registerMediaSession = useCallback((
    onPlay: () => void,
    onPause: () => void,
  ) => {
    if (!("mediaSession" in navigator)) return;
    enableNativePlaybackSession();
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Morning Practice",
      artist: "YOUtopia",
      album: "Daily Practice",
    });
    try { navigator.mediaSession.setActionHandler("play", onPlay); } catch {}
    try { navigator.mediaSession.setActionHandler("pause", onPause); } catch {}
    navigator.mediaSession.playbackState = "playing";
  }, []);

  /** Keep lock-screen audio alive. On iOS, the AudioContext is suspended when
   *  the screen locks and all scheduled source nodes are dropped. On unlock,
   *  we detect the suspended context and re-schedule from the current position. */
  useEffect(() => {
    const keepSessionActive = () => {
      if (!isPlayingRef.current) return;

      if (document.visibilityState === "visible") {
        // Screen just unlocked — iOS suspends AudioContext on lock and drops all
        // scheduled source nodes. Re-create them from the correct current position.
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          resumeRef.current?.();
          return; // resumeRef restarts the rAF tick via playFromOffset
        }
      }

      enableNativePlaybackSession();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
        updateMediaSessionPosition(totalDurationRef.current, getPlaybackPosition());
      }
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => tickRef.current?.());
    };
    document.addEventListener("visibilitychange", keepSessionActive);
    window.addEventListener("pagehide", keepSessionActive);
    window.addEventListener("pageshow", keepSessionActive);
    return () => {
      document.removeEventListener("visibilitychange", keepSessionActive);
      window.removeEventListener("pagehide", keepSessionActive);
      window.removeEventListener("pageshow", keepSessionActive);
    };
  }, [getPlaybackPosition]);

  const tick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = getPlaybackPosition(ctx);
    const total = totalDurationRef.current;
    setCurrentTime(Math.min(elapsed, total));
    setProgress(Math.min((elapsed / total) * 100, 100));
    updateMediaSessionPosition(total, elapsed);
    if (elapsed < total) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [getPlaybackPosition]);
  tickRef.current = tick;

  const stopAllSources = useCallback(() => {
    activeSourcesRef.current.forEach((s) => { try { s.stop(); } catch {} });
    activeSourcesRef.current = [];
    duckTimersRef.current.forEach(clearTimeout);
    duckTimersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  }, []);

  // arcLevelAt is defined at module scope above the hook.

  const playFromOffset = useCallback(async (fromOffset: number) => {
    const ctx = audioCtxRef.current;
    const buffers = segmentBuffersRef.current;
    if (!ctx || buffers.length === 0) return;

    enableNativePlaybackSession();
    if (ctx.state === "suspended") await ctx.resume();

    const { events, totalDuration } = buildTimeline();
    totalDurationRef.current = totalDuration;
    setDuration(totalDuration);

    const clampedOffset = Math.max(0, Math.min(fromOffset, totalDuration));
    offsetRef.current = clampedOffset;

    const now = ctx.currentTime;
    startTimeRef.current = now;

    // ---------- Shared reverb for voice segments ----------
    const reverb = createReverb(ctx, 4.5, 2.2);
    reverb.output.connect(ctx.destination);

    // ---------- MUSIC via <audio> element — survives iOS screen lock ----------
    // AudioBufferSourceNode is suspended by iOS when the screen locks.
    // A plain <audio> element is handled by iOS's native media system (same
    // as Spotify) and keeps playing regardless of lock state.
    const musicEl = musicElementRef.current;
    if (musicEl) {
      duckTimersRef.current.forEach(clearTimeout);
      duckTimersRef.current = [];

      musicEl.pause();

      // Calculate starting volume based on arc position
      let startVol: number;
      if (clampedOffset === 0) {
        startVol = 0;
      } else if (clampedOffset < MUSIC_RAMP_SECS) {
        startVol = musicVolume * ARC.fadeInPeak * (clampedOffset / MUSIC_RAMP_SECS);
      } else {
        startVol = musicVolume * arcLevelAt(clampedOffset, events);
      }
      musicEl.volume = startVol;

      const startPlayback = () => {
        if (musicEl.duration) musicEl.currentTime = clampedOffset % musicEl.duration;
        musicEl.play().catch(() => {});
        // Fade in if starting from silence
        if (clampedOffset < MUSIC_RAMP_SECS) {
          fadeVol(musicEl, musicVolume * ARC.fadeInPeak, Math.max(100, (MUSIC_RAMP_SECS - clampedOffset) * 1000));
        }
      };
      if (musicEl.readyState >= 1) {
        startPlayback();
      } else {
        musicEl.addEventListener("loadedmetadata", startPlayback, { once: true });
      }

      // Arc volume shifts — scheduled with setTimeout so they fire on the
      // active screen. During lock, music plays at whatever volume it was at;
      // voice segments (AudioBufferSourceNode) also pause during lock so
      // there is nothing to duck anyway.
      const arcTimers: { at: number; vol: number }[] = [];
      if (events[1]) arcTimers.push({ at: events[1].startOffset - 10, vol: musicVolume * ARC.section2 });
      if (events[2]) arcTimers.push({ at: events[2].startOffset - 10, vol: musicVolume * ARC.section3 });
      const returnEvt = events.length > 1 ? events[events.length - 1] : null;
      if (returnEvt) arcTimers.push({ at: returnEvt.startOffset - 10, vol: musicVolume * ARC.section4 });

      arcTimers.forEach(({ at, vol }) => {
        if (at <= clampedOffset) return;
        duckTimersRef.current.push(
          setTimeout(() => fadeVol(musicEl, vol, 10000), (at - clampedOffset) * 1000),
        );
      });

      // Per-segment ducking
      events.forEach((evt) => {
        const segEnd = evt.startOffset + evt.duration;
        if (segEnd <= clampedOffset) return;

        const arcLevel = musicVolume * arcLevelAt(evt.startOffset, events);
        const segDuckRatio = evt.duration < 90 ? 0.80 : DUCK_RATIO;
        const duckLevel = arcLevel * segDuckRatio;
        const duckMs = Math.max(0, (evt.startOffset - DUCK_PRE_RAMP - clampedOffset) * 1000);
        const restoreMs = Math.max(0, (segEnd + DUCK_POST_RAMP - clampedOffset) * 1000);

        duckTimersRef.current.push(
          setTimeout(() => fadeVol(musicEl, duckLevel, DUCK_PRE_RAMP * 1000), duckMs),
          setTimeout(() => fadeVol(musicEl, arcLevel, DUCK_POST_RAMP * 1000), restoreMs),
        );
      });

      // Final fade-out
      const fadeOutStart = totalDuration - resolvedFadeOut;
      const fadeOutMs = Math.max(0, (fadeOutStart - clampedOffset) * 1000);
      duckTimersRef.current.push(
        setTimeout(() => fadeVol(musicEl, 0, resolvedFadeOut * 1000), fadeOutMs),
      );
    }

    // ---------- Voice bus — one bus for all segments, shared reverb ----------
    const voiceBus = createVoiceBus(ctx, reverb.input, ctx.destination, {
      dryLevel: narrationVolume,
      wetLevel: VOICE_WET,
      lowpass: VOICE_LPF,
    });

    events.forEach((evt) => {
      const segEnd = evt.startOffset + evt.duration;
      if (segEnd <= clampedOffset) return;

      const source = ctx.createBufferSource();
      source.buffer = buffers[evt.index];
      source.playbackRate.value = VOICE_RATE;
      source.connect(voiceBus.input);

      if (clampedOffset > evt.startOffset) {
        const skipInto = (clampedOffset - evt.startOffset) * VOICE_RATE;
        source.start(now, skipInto);
      } else {
        const delay = evt.startOffset - clampedOffset;
        source.start(now + delay);
      }
      activeSourcesRef.current.push(source);
    });

    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    setHasStarted(true);
    updateMediaSessionPosition(totalDuration, clampedOffset);
    registerMediaSession(
      () => {
        const c = audioCtxRef.current;
        if (!c) return;
        void c.resume().then(() => {
          isPlayingRef.current = true;
          setIsPlaying(true);
          setIsPaused(false);
          navigator.mediaSession.playbackState = "playing";
        });
      },
      () => { pauseRef.current?.(); },
    );
    if ("mediaSession" in navigator) {
      // seekforward/seekbackward are a Chrome extension — not available on all
      // Android WebViews; wrap in try/catch so unsupported browsers don't throw.
      try {
        navigator.mediaSession.setActionHandler("seekforward", () => {
          const c = audioCtxRef.current;
          if (!c) return;
          const elapsed = getPlaybackPosition(c);
          const newPos = Math.min(elapsed + 30, totalDurationRef.current);
          stopAllSources();
          if (c.state === "suspended") void c.resume();
          offsetRef.current = newPos;
          playFromOffset(newPos);
        });
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          const c = audioCtxRef.current;
          if (!c) return;
          const elapsed = getPlaybackPosition(c);
          const newPos = Math.max(elapsed - 30, 0);
          stopAllSources();
          if (c.state === "suspended") void c.resume();
          offsetRef.current = newPos;
          playFromOffset(newPos);
        });
      } catch {}
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [musicVolume, narrationVolume, resolvedFadeIn, resolvedFadeOut, buildTimeline, tick, registerMediaSession, stopAllSources, getPlaybackPosition]);

  const playSequence = useCallback(async () => {
    if (segmentUrls.length === 0) return;
    // Already loaded — go straight to playback
    if (segmentBuffersRef.current.length > 0) {
      playFromOffset(0);
      return;
    }
    // Already loading — prevent double-initialisation (second tap while loading)
    if (audioCtxRef.current) return;
    setIsLoading(true);
    setLoadError(false);
    try {
      enableNativePlaybackSession();
      // Silent keepalive — keeps iOS audio session active through screen lock
      // so the AudioContext (voice narration, reverb, ducking) never gets suspended.
      startAudioKeepalive();
      const ctx = new AudioContext({ latencyHint: "playback" });
      audioCtxRef.current = ctx;
      // Load segments ONE AT A TIME — parallel fetches exceed mobile memory budgets
      // and trigger silent failures on iOS Safari (no error, just hangs).
      const loaded: AudioBuffer[] = [];
      for (const url of segmentUrls) {
        try {
          loaded.push(await loadBuffer(ctx, url));
        } catch (e) {
          console.warn("Segment failed to load, skipping:", url, e);
        }
      }
      segmentBuffersRef.current = loaded;
      if (musicUrl) {
        // Plain <audio> element — iOS keeps this playing through screen lock.
        // We do NOT load music into an AudioBuffer; streaming directly means
        // faster start and background-safe playback (same as Spotify web).
        const el = new Audio(musicUrl);
        el.loop = true;
        el.crossOrigin = "anonymous";
        el.volume = 0;
        el.load();
        musicElementRef.current = el;
      }
      const { totalDuration } = buildTimeline();
      setDuration(totalDuration);
      setIsLoading(false);
      playFromOffset(0);
    } catch (e) {
      console.error("Audio loading error:", e);
      setLoadError(true);
      setIsLoading(false);
    }
  }, [segmentUrls, musicUrl, buildTimeline, playFromOffset]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return;
    offsetRef.current = getPlaybackPosition(ctx);
    ctx.suspend();
    musicElementRef.current?.pause();
    duckTimersRef.current.forEach(clearTimeout);
    duckTimersRef.current = [];
    cancelAnimationFrame(rafRef.current);
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(true);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
      updateMediaSessionPosition(totalDurationRef.current, offsetRef.current);
    }
  }, [getPlaybackPosition]);
  pauseRef.current = pause;

  const resume = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    // Calculate the true playback position BEFORE stopping sources — offsetRef
    // is stale after a screen lock (it holds the start position, not elapsed
    // time). We capture the real position now, then re-schedule the entire
    // timeline from there so playback continues exactly where it was.
    const currentPos = getPlaybackPosition(ctx);
    offsetRef.current = currentPos;
    stopAllSources();
    playFromOffset(currentPos);
  }, [stopAllSources, playFromOffset, getPlaybackPosition]);
  resumeRef.current = resume;

  const stopAll = useCallback(() => {
    const musicEl = musicElementRef.current;
    if (musicEl) {
      fadeVol(musicEl, 0, 1000);
      setTimeout(() => {
        musicEl.pause();
        if (musicElementRef.current === musicEl) musicElementRef.current = null;
      }, 1100);
    }
    stopAllSources();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    segmentBuffersRef.current = [];
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setHasStarted(false);
    offsetRef.current = 0;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
    stopAudioKeepalive();
  }, [stopAllSources]);

  const skip = useCallback((seconds: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlayingRef.current;
    const currentPos = getPlaybackPosition(ctx);
    const newPos = Math.max(0, Math.min(currentPos + seconds, totalDurationRef.current));

    stopAllSources();
    // Reuse the existing AudioContext — creating a new one here would orphan the
    // already-decoded AudioBuffer objects, causing NotSupportedError on Safari/iOS
    // when those buffers are assigned to source nodes in the new context.
    if (ctx.state === "suspended") void ctx.resume();
    offsetRef.current = newPos;

    if (wasPlaying || isPaused) playFromOffset(newPos);
    else {
      setCurrentTime(newPos);
      setProgress((newPos / totalDurationRef.current) * 100);
    }
  }, [isPaused, stopAllSources, playFromOffset, getPlaybackPosition]);

  const skipForward = useCallback(() => skip(30), [skip]);
  const skipBackward = useCallback(() => skip(-30), [skip]);

  const seekTo = useCallback((timeInSeconds: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlayingRef.current;
    const newPos = Math.max(0, Math.min(timeInSeconds, totalDurationRef.current));

    stopAllSources();
    // Same reason as skip() — reuse the existing context to avoid buffer/context mismatch.
    if (ctx.state === "suspended") void ctx.resume();
    offsetRef.current = newPos;

    if (wasPlaying || isPaused) playFromOffset(newPos);
    else {
      setCurrentTime(newPos);
      setProgress((newPos / totalDurationRef.current) * 100);
    }
  }, [isPaused, stopAllSources, playFromOffset]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else if (isPaused) resume();
    else playSequence();
  }, [isPlaying, isPaused, pause, resume, playSequence]);

  return {
    isPlaying, isPaused, isLoading, loadError, progress, currentTime, duration,
    currentSegment, hasStarted, togglePlay, stop: stopAll,
    skipForward, skipBackward, seekTo,
  };
}
