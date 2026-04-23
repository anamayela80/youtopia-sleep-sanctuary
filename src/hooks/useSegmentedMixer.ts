import { useRef, useState, useCallback, useEffect } from "react";
import { createReverb, createVoiceBus } from "@/lib/audioEffects";

/**
 * Segmented meditation mixer: 4 narration segments spaced over music bridges.
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
}

// Ducking
const DUCK_RATIO = 0.45;       // music drops to 45% of current arc level under voice
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
  musicBridgeDurations = [0, 135, 150, 135],
  musicFadeInDuration = 60,
  musicFadeOutDuration = 120,
  musicVolume = 0.42,
  narrationVolume = 0.72,
}: UseSegmentedMixerOptions) {
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
    let t = musicFadeInDuration;
    buffers.forEach((buf, i) => {
      const effectiveDuration = buf.duration / VOICE_RATE;
      events.push({ index: i, startOffset: t, duration: effectiveDuration });
      t += effectiveDuration;
      if (i < buffers.length - 1) t += musicBridgeDurations[i + 1] || 60;
    });
    const totalDur = t + musicFadeOutDuration;
    return { events, totalDuration: totalDur };
  }, [musicFadeInDuration, musicFadeOutDuration, musicBridgeDurations]);

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
    if (sessionTime < events[0].startOffset) return ARC.fadeInPeak;
    if (sessionTime < events[1]?.startOffset) return ARC.fadeInPeak;
    if (sessionTime < events[2]?.startOffset) return ARC.section2;
    if (sessionTime < events[3]?.startOffset) return ARC.section3;
    return ARC.section4;
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

      // Send a small amount of music into the reverb too — same "room"
      const musicSend = ctx.createGain();
      musicSend.gain.value = 0.08;
      musicSend.connect(reverb.input);

      musicSource.connect(gainNode);
      gainNode.connect(ctx.destination);
      gainNode.connect(musicSend);

      const toCtx = (abs: number) => now + Math.max(0.005, abs - clampedOffset);

      // Starting gain — where are we in the arc at the current offset?
      let startGain = 0;
      if (clampedOffset < musicFadeInDuration) {
        startGain = (clampedOffset / musicFadeInDuration) * musicVolume * ARC.fadeInPeak;
      } else {
        startGain = musicVolume * arcLevelAt(clampedOffset, events);
      }
      gainNode.gain.setValueAtTime(startGain, now);

      // Remaining fade-in
      if (clampedOffset < musicFadeInDuration) {
        gainNode.gain.linearRampToValueAtTime(
          musicVolume * ARC.fadeInPeak,
          toCtx(musicFadeInDuration),
        );
      }

      // Arc waypoints between sections
      const sectionTransitions: { at: number; level: number }[] = [];
      if (events[1]) sectionTransitions.push({ at: events[1].startOffset - 10, level: musicVolume * ARC.section2 });
      if (events[2]) sectionTransitions.push({ at: events[2].startOffset - 10, level: musicVolume * ARC.section3 });
      if (events[3]) sectionTransitions.push({ at: events[3].startOffset - 10, level: musicVolume * ARC.section4 });

      sectionTransitions.forEach(({ at, level }) => {
        if (at > clampedOffset) gainNode.gain.linearRampToValueAtTime(level, toCtx(at));
      });

      // ---------- Per-segment ducking ----------
      events.forEach((evt) => {
        const segEnd = evt.startOffset + evt.duration;
        if (segEnd <= clampedOffset) return;

        const arcLevel = musicVolume * arcLevelAt(evt.startOffset, events);
        const duckLevel = arcLevel * DUCK_RATIO;

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

      // Final fade-out
      const fadeOutStart = totalDuration - musicFadeOutDuration;
      if (clampedOffset < fadeOutStart) {
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
  }, [musicVolume, narrationVolume, musicFadeInDuration, musicFadeOutDuration, buildTimeline, tick]);

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
