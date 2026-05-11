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
import { enableNativePlaybackSession, updateMediaSessionPosition } from "@/lib/mobileAudioSession";

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
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const totalDurationRef = useRef(0);
  const isPlayingRef = useRef(false);
  const tickRef = useRef<(() => void) | null>(null);
  const pauseRef = useRef<(() => void) | null>(null);

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

  /** Keep lock-screen audio alive by leaving playback running when the document
   *  is hidden. Mobile browsers suspend timers, so the UI clock catches up from
   *  the AudioContext clock when the app becomes visible again. */
  useEffect(() => {
    const keepSessionActive = () => {
      if (!isPlayingRef.current) return;
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
    try { musicSourceRef.current?.stop(); } catch {}
    musicSourceRef.current = null;
    musicGainRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  // arcLevelAt is defined at module scope above the hook.

  const playFromOffset = useCallback(async (fromOffset: number) => {
    const ctx = audioCtxRef.current;
    const buffers = segmentBuffersRef.current;
    const musicBuf = musicBufferRef.current;
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

    // ---------- Shared reverb for the whole session ----------
    const reverb = createReverb(ctx, 4.5, 2.2);
    reverb.output.connect(ctx.destination);

    // ---------- Music chain with arc + per-segment ducking ----------
    if (musicBuf) {
      const musicSource = ctx.createBufferSource();
      musicSource.buffer = musicBuf;
      musicSource.loop = true;
      const gainNode = ctx.createGain();

      // Compressor — evens out the music track's natural quiet passages
      // so soft ambient sections never drop to near-silence on phone speakers.
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -24;  // start compressing at -24 dB
      compressor.knee.value = 10;        // soft knee for transparent sound
      compressor.ratio.value = 4;        // 4:1 ratio — moderate compression
      compressor.attack.value = 0.1;     // 100 ms attack, gentle
      compressor.release.value = 0.6;    // 600 ms release, natural

      // Send a small amount of music into the reverb too — same "room"
      const musicSend = ctx.createGain();
      musicSend.gain.value = 0.08;
      musicSend.connect(reverb.input);

      musicSource.connect(compressor);
      compressor.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.connect(musicSend);

      const toCtx = (abs: number) => now + Math.max(0.005, abs - clampedOffset);

      // Music gain: always audible within the first few seconds.
      // We decouple the "audible ramp" (8 s to reach peak) from the voice
      // entry time (resolvedFadeIn ≈ 60 s).  This prevents the previous glitch
      // where the gain was still near-zero when the ducking setValueAtTime call
      // kicked in 1.8 s before the voice, producing a perceptible pop.
      // MUSIC_RAMP_SECS is imported from lib/sessionTiming.ts
      let startGain: number;
      if (clampedOffset === 0) {
        startGain = 0;
      } else if (clampedOffset < MUSIC_RAMP_SECS) {
        startGain = musicVolume * ARC.fadeInPeak * (clampedOffset / MUSIC_RAMP_SECS);
      } else {
        startGain = musicVolume * arcLevelAt(clampedOffset, events);
      }
      gainNode.gain.setValueAtTime(startGain, now);

      // Ramp to peak quickly — music is clearly audible before voice enters
      if (clampedOffset < MUSIC_RAMP_SECS) {
        gainNode.gain.linearRampToValueAtTime(
          musicVolume * ARC.fadeInPeak,
          now + Math.max(0.1, MUSIC_RAMP_SECS - clampedOffset),
        );
      }

      // Arc waypoints between sections.
      // Music rises through sections 2→3 (section2→section3 peak),
      // then drops to section4 only at the final Return segment.
      // Works with any segment count (5 or 6 narration segments).
      const sectionTransitions: { at: number; level: number }[] = [];
      if (events[1]) sectionTransitions.push({ at: events[1].startOffset - 10, level: musicVolume * ARC.section2 });
      if (events[2]) sectionTransitions.push({ at: events[2].startOffset - 10, level: musicVolume * ARC.section3 });
      const returnEvt = events.length > 1 ? events[events.length - 1] : null;
      if (returnEvt) sectionTransitions.push({ at: returnEvt.startOffset - 10, level: musicVolume * ARC.section4 });

      sectionTransitions.forEach(({ at, level }) => {
        if (at > clampedOffset) gainNode.gain.linearRampToValueAtTime(level, toCtx(at));
      });

      // ---------- Per-segment ducking ----------
      events.forEach((evt) => {
        const segEnd = evt.startOffset + evt.duration;
        if (segEnd <= clampedOffset) return;

        const arcLevel = musicVolume * arcLevelAt(evt.startOffset, events);
        // Short segments are dissolution (staccato, ~50-70s of sparse speech).
        // A 55% duck on top of near-silence sounds like the music has disappeared.
        // Use a much lighter duck (20%) so the music holds the space through dissolution.
        const segDuckRatio = evt.duration < 90 ? 0.80 : DUCK_RATIO;
        const duckLevel = arcLevel * segDuckRatio;

        const duckDownStart = Math.max(clampedOffset, evt.startOffset - DUCK_PRE_RAMP);
        const duckDownEnd = evt.startOffset;
        const restoreStart = segEnd;
        const restoreEnd = segEnd + DUCK_POST_RAMP;

        if (duckDownStart > clampedOffset) {
          gainNode.gain.setValueAtTime(arcLevel, toCtx(duckDownStart));
        }
        gainNode.gain.linearRampToValueAtTime(duckLevel, toCtx(duckDownEnd));
        gainNode.gain.setValueAtTime(duckLevel, toCtx(restoreStart));
        gainNode.gain.linearRampToValueAtTime(arcLevel, toCtx(restoreEnd));
      });

      // Final fade-out — anchor the gain explicitly at fadeOutStart so the
      // ramp-to-zero does not interpolate backwards from the initial 8-second
      // ramp (which would cause a slow, whole-session fade creating perceived
      // silences at ~9:40, ~15:52, ~19:44).
      const fadeOutStart = totalDuration - resolvedFadeOut;
      if (clampedOffset < fadeOutStart) {
        const arcAtFade = musicVolume * arcLevelAt(fadeOutStart, events);
        gainNode.gain.setValueAtTime(arcAtFade, toCtx(fadeOutStart));
        gainNode.gain.linearRampToValueAtTime(0, toCtx(totalDuration));
      } else {
        gainNode.gain.linearRampToValueAtTime(0, now + (totalDuration - clampedOffset));
      }

      musicSource.start(now, clampedOffset % musicBuf.duration);
      musicSource.stop(now + (totalDuration - clampedOffset) + 0.1);
      musicSourceRef.current = musicSource;
      musicGainRef.current = gainNode;
      // Do NOT push musicSource into activeSourcesRef — stopAllSources already
      // calls musicSourceRef.current?.stop() separately, and stopping twice
      // throws InvalidStateError on Safari.
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
          const elapsed = isPlayingRef.current
            ? offsetRef.current + (c.currentTime - startTimeRef.current)
            : offsetRef.current;
          const newPos = Math.min(elapsed + 30, totalDurationRef.current);
          stopAllSources();
          if (c.state === "suspended") c.resume();
          offsetRef.current = newPos;
          playFromOffset(newPos);
        });
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          const c = audioCtxRef.current;
          if (!c) return;
          const elapsed = isPlayingRef.current
            ? offsetRef.current + (c.currentTime - startTimeRef.current)
            : offsetRef.current;
          const newPos = Math.max(elapsed - 30, 0);
          stopAllSources();
          if (c.state === "suspended") c.resume();
          offsetRef.current = newPos;
          playFromOffset(newPos);
        });
      } catch {}
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [musicVolume, narrationVolume, resolvedFadeIn, resolvedFadeOut, buildTimeline, tick, registerMediaSession, stopAllSources]);

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
        try {
          musicBufferRef.current = await loadBuffer(ctx, musicUrl);
        } catch (e) {
          console.warn("Music failed to load, continuing without it:", e);
        }
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
    // After an iOS screen-off pause, our scheduled source nodes may have been
    // dropped by the OS. The only reliable way back is to re-schedule the
    // entire timeline from the saved offset (playFromOffset also calls
    // ctx.resume() — which is allowed here because we're inside the user's
    // tap-to-play gesture).
    stopAllSources();
    playFromOffset(offsetRef.current);
  }, [stopAllSources, playFromOffset]);

  const stopAll = useCallback(() => {
    stopAllSources();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    segmentBuffersRef.current = [];
    musicBufferRef.current = null;
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setHasStarted(false);
    offsetRef.current = 0;
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
  }, [stopAllSources]);

  const skip = useCallback((seconds: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlayingRef.current;
    const currentPos = wasPlaying
      ? offsetRef.current + (ctx.currentTime - startTimeRef.current)
      : offsetRef.current;
    const newPos = Math.max(0, Math.min(currentPos + seconds, totalDurationRef.current));

    stopAllSources();
    // Reuse the existing AudioContext — creating a new one here would orphan the
    // already-decoded AudioBuffer objects, causing NotSupportedError on Safari/iOS
    // when those buffers are assigned to source nodes in the new context.
    if (ctx.state === "suspended") ctx.resume();
    offsetRef.current = newPos;

    if (wasPlaying || isPaused) playFromOffset(newPos);
    else {
      setCurrentTime(newPos);
      setProgress((newPos / totalDurationRef.current) * 100);
    }
  }, [isPaused, stopAllSources, playFromOffset]);

  const skipForward = useCallback(() => skip(30), [skip]);
  const skipBackward = useCallback(() => skip(-30), [skip]);

  const seekTo = useCallback((timeInSeconds: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlayingRef.current;
    const newPos = Math.max(0, Math.min(timeInSeconds, totalDurationRef.current));

    stopAllSources();
    // Same reason as skip() — reuse the existing context to avoid buffer/context mismatch.
    if (ctx.state === "suspended") ctx.resume();
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
