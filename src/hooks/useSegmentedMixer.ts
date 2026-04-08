import { useRef, useState, useCallback, useEffect } from "react";

interface UseSegmentedMixerOptions {
  segmentUrls: string[];
  musicUrl: string | null;
  musicBridgeDurations?: number[];
  musicFadeInDuration?: number;
  musicFadeOutDuration?: number;
  musicVolume?: number;
}

export function useSegmentedMixer({
  segmentUrls,
  musicUrl,
  musicBridgeDurations = [60, 60, 75, 60],
  musicFadeInDuration = 60,
  musicFadeOutDuration = 90,
  musicVolume = 0.3,
}: UseSegmentedMixerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const segmentBuffersRef = useRef<AudioBuffer[]>([]);
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0); // virtual offset into the timeline
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

  // Build the timeline: returns array of { startOffset, duration } for each segment
  const buildTimeline = useCallback(() => {
    const buffers = segmentBuffersRef.current;
    const events: { type: "segment"; index: number; startOffset: number; duration: number }[] = [];
    let t = musicFadeInDuration;
    buffers.forEach((buf, i) => {
      events.push({ type: "segment", index: i, startOffset: t, duration: buf.duration });
      t += buf.duration;
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

        let total = musicFadeInDuration;
        buffers.forEach((buf, i) => {
          total += buf.duration;
          if (i < buffers.length - 1) total += musicBridgeDurations[i + 1] || 60;
        });
        total += musicFadeOutDuration;
        setDuration(total);
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
    try { musicSourceRef.current?.stop(); } catch {};
    musicSourceRef.current = null;
    musicGainRef.current = null;
    cancelAnimationFrame(rafRef.current);
  }, []);

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

    // Schedule music from offset
    if (musicBuf) {
      const musicSource = ctx.createBufferSource();
      musicSource.buffer = musicBuf;
      musicSource.loop = true;
      const gainNode = ctx.createGain();

      // Compute current music gain at this offset
      let currentGain = musicVolume;
      if (clampedOffset < musicFadeInDuration) {
        currentGain = (clampedOffset / musicFadeInDuration) * musicVolume;
      }
      const fadeOutStart = totalDuration - musicFadeOutDuration;
      if (clampedOffset >= fadeOutStart) {
        currentGain = Math.max(0, ((totalDuration - clampedOffset) / musicFadeOutDuration) * musicVolume);
      }

      gainNode.gain.setValueAtTime(currentGain, now);

      // Schedule remaining fade-in
      if (clampedOffset < musicFadeInDuration) {
        const remainFade = musicFadeInDuration - clampedOffset;
        gainNode.gain.linearRampToValueAtTime(musicVolume, now + remainFade);
      }

      // Schedule fade-out
      const fadeOutStartOffset = totalDuration - musicFadeOutDuration;
      if (clampedOffset < fadeOutStartOffset) {
        const fadeOutAt = now + (fadeOutStartOffset - clampedOffset);
        gainNode.gain.setValueAtTime(musicVolume, fadeOutAt);
        gainNode.gain.linearRampToValueAtTime(0, fadeOutAt + musicFadeOutDuration);
      } else if (clampedOffset < totalDuration) {
        // Already in fade-out zone
        const remaining = totalDuration - clampedOffset;
        gainNode.gain.linearRampToValueAtTime(0, now + remaining);
      }

      musicSource.connect(gainNode).connect(ctx.destination);
      // Start music at a looped position
      musicSource.start(now, clampedOffset % musicBuf.duration);
      musicSourceRef.current = musicSource;
      musicGainRef.current = gainNode;
      activeSourcesRef.current.push(musicSource);

      // Stop music at end
      const musicStopAt = now + (totalDuration - clampedOffset) + 0.1;
      musicSource.stop(musicStopAt);
    }

    // Schedule segments that are still relevant
    events.forEach((evt) => {
      const segEnd = evt.startOffset + evt.duration;
      if (segEnd <= clampedOffset) return; // already passed

      const source = ctx.createBufferSource();
      source.buffer = buffers[evt.index];
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      source.connect(gain).connect(ctx.destination);

      if (clampedOffset > evt.startOffset) {
        // We're in the middle of this segment
        const skipInto = clampedOffset - evt.startOffset;
        source.start(now, skipInto);
      } else {
        // Schedule in the future
        const delay = evt.startOffset - clampedOffset;
        source.start(now + delay);
      }
      activeSourcesRef.current.push(source);
    });

    setIsPlaying(true);
    setIsPaused(false);
    setHasStarted(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [musicVolume, musicFadeInDuration, musicFadeOutDuration, buildTimeline, tick]);

  const playSequence = useCallback(() => {
    playFromOffset(0);
  }, [playFromOffset]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return;
    // Capture current position before suspending
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

    // Need a fresh context since sources are one-shot
    const newCtx = new AudioContext();
    audioCtxRef.current = newCtx;
    offsetRef.current = newPos;

    if (wasPlaying || isPaused) {
      playFromOffset(newPos);
    } else {
      setCurrentTime(newPos);
      setProgress((newPos / totalDurationRef.current) * 100);
    }
  }, [isPlaying, isPaused, stopAllSources, playFromOffset]);

  const skipForward = useCallback(() => skip(30), [skip]);
  const skipBackward = useCallback(() => skip(-30), [skip]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      playSequence();
    }
  }, [isPlaying, isPaused, pause, resume, playSequence]);

  return {
    isPlaying, isPaused, isLoading, progress, currentTime, duration,
    currentSegment, hasStarted, togglePlay, stop: stopAll,
    skipForward, skipBackward,
  };
}
