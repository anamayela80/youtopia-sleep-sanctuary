import { useRef, useState, useCallback, useEffect } from "react";
import { createReverb, createVoiceBus } from "@/lib/audioEffects";

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
const TENURE_TIMING = {
  orienting:   { fadeIn: 75, bridges: [0, 150, 215, 90, 90, 120], fadeOut: 105 },
  settling:    { fadeIn: 75, bridges: [0, 150, 210, 90, 75, 120], fadeOut: 75 },
  established: { fadeIn: 90, bridges: [0, 210, 300, 120, 90, 150], fadeOut: 90 },
};

// Ducking
const DUCK_RATIO = 0.65;       // music drops to 65% of current arc level under voice
const DUCK_PRE_RAMP = 1.8;     // time to dip down before voice starts
const DUCK_POST_RAMP = 2.8;    // time to restore after voice ends
const VOICE_RATE = 0.98;

// Voice bus
const VOICE_WET = 0.30;        // reverb send — voice blooms into music space
const VOICE_LPF = 4500;

// Music arc (as multipliers of musicVolume)
const ARC = {
  fadeInPeak: 0.75,   // after fade-in (section 1)
  section2:   0.85,   // gratitude rising
  section3:   1.00,   // vision / heart — peak
  section4:   0.70,   // return / anchor
};

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
  const tenureDefaults = TENURE_TIMING[tenureBand ?? "orienting"];
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

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSegment, setCurrentSegment] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const loadBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  };

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

  useEffect(() => {
    if (segmentUrls.length === 0) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;

        const buffers = await Promise.all(segmentUrls.map((url) => loadBuffer(ctx, url)));
        segmentBuffersRef.current = buffers;

        if (musicUrl) {
          musicBufferRef.current = await loadBuffer(ctx, musicUrl);
        }

        const { totalDuration } = buildTimeline();
        setDuration(totalDuration);
      } catch (e) {
        console.error("Audio loading error:", e);
      } finally {
        setIsLoading(false);
      }
    };

    load();
    return () => {
      stopAll();
      audioCtxRef.current?.close();
    };
  }, [segmentUrls.join(","), musicUrl]);

  const tick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = offsetRef.current + (ctx.currentTime - startTimeRef.current);
    const total = totalDurationRef.current;
    setCurrentTime(Math.min(elapsed, total));
    setProgress(Math.min((elapsed / total) * 100, 100));
    if (elapsed < total) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, []);

  const stopAllSources = useCallback(() => {
    activeSourcesRef.current.forEach((s) => { try { s.stop(); } catch {} });
    activeSourcesRef.current = [];
    try { musicSourceRef.current?.stop(); } catch {}
    musicSourceRef.current = null;
    musicGainRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

  /** Which section's peak level applies at this session time */
  const arcLevelAt = (sessionTime: number, events: { startOffset: number; duration: number }[]) => {
    if (events.length === 0) return ARC.fadeInPeak;
    if (sessionTime < (events[0]?.startOffset ?? Infinity)) return ARC.fadeInPeak;
    if (sessionTime < (events[1]?.startOffset ?? Infinity)) return ARC.fadeInPeak;
    if (sessionTime < (events[2]?.startOffset ?? Infinity)) return ARC.section2;
    // Music stays at peak (section3) through every segment except the final
    // Return segment — regardless of whether the session has 5 or 6 segments.
    const returnSeg = events[events.length - 1];
    if (returnSeg && sessionTime >= returnSeg.startOffset) return ARC.section4;
    return ARC.section3;
  };

  const playFromOffset = useCallback((fromOffset: number) => {
    const ctx = audioCtxRef.current;
    const buffers = segmentBuffersRef.current;
    const musicBuf = musicBufferRef.current;
    if (!ctx || buffers.length === 0) return;

    if (ctx.state === "suspended") ctx.resume();

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
      const MUSIC_RAMP_SECS = 8; // seconds to reach peak from silence
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
      activeSourcesRef.current.push(musicSource);
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

    setIsPlaying(true);
    setIsPaused(false);
    setHasStarted(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [musicVolume, narrationVolume, resolvedFadeIn, resolvedFadeOut, buildTimeline, tick]);

  const playSequence = useCallback(() => {
    playFromOffset(0);
  }, [playFromOffset]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return;
    offsetRef.current = offsetRef.current + (ctx.currentTime - startTimeRef.current);
    ctx.suspend();
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "suspended") return;
    startTimeRef.current = ctx.currentTime;
    ctx.resume();
    setIsPlaying(true);
    setIsPaused(false);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stopAll = useCallback(() => {
    stopAllSources();
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setHasStarted(false);
    offsetRef.current = 0;
  }, [stopAllSources]);

  const skip = useCallback((seconds: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlaying;
    const currentPos = wasPlaying
      ? offsetRef.current + (ctx.currentTime - startTimeRef.current)
      : offsetRef.current;
    const newPos = Math.max(0, Math.min(currentPos + seconds, totalDurationRef.current));

    stopAllSources();
    const newCtx = new AudioContext();
    audioCtxRef.current = newCtx;
    offsetRef.current = newPos;

    if (wasPlaying || isPaused) playFromOffset(newPos);
    else {
      setCurrentTime(newPos);
      setProgress((newPos / totalDurationRef.current) * 100);
    }
  }, [isPlaying, isPaused, stopAllSources, playFromOffset]);

  const skipForward = useCallback(() => skip(30), [skip]);
  const skipBackward = useCallback(() => skip(-30), [skip]);

  const seekTo = useCallback((timeInSeconds: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlaying;
    const newPos = Math.max(0, Math.min(timeInSeconds, totalDurationRef.current));

    stopAllSources();
    const newCtx = new AudioContext();
    audioCtxRef.current = newCtx;
    offsetRef.current = newPos;

    if (wasPlaying || isPaused) playFromOffset(newPos);
    else {
      setCurrentTime(newPos);
      setProgress((newPos / totalDurationRef.current) * 100);
    }
  }, [isPlaying, isPaused, stopAllSources, playFromOffset]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else if (isPaused) resume();
    else playSequence();
  }, [isPlaying, isPaused, pause, resume, playSequence]);

  return {
    isPlaying, isPaused, isLoading, progress, currentTime, duration,
    currentSegment, hasStarted, togglePlay, stop: stopAll,
    skipForward, skipBackward, seekTo,
  };
}
