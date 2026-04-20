import { useRef, useState, useCallback, useEffect } from "react";

interface UseSeedsPlayerOptions {
  seedAudioUrls: string[];
  musicUrl: string | null;
  musicVolume?: number;
  pauseDuration?: number;
  /** Total session length in seconds. Defaults to 45 minutes. */
  totalDuration?: number;
  musicFadeInDuration?: number;
  musicFadeOutDuration?: number;
  /** Volume of seed phrases — kept low so it feels like a whisper for sleep. */
  seedVolume?: number;
}

export function useSeedsPlayer({
  seedAudioUrls,
  musicUrl,
  musicVolume = 0.18,
  pauseDuration = 35,
  totalDuration = 45 * 60,
  musicFadeInDuration = 60,
  musicFadeOutDuration = 120,
  seedVolume = 0.45,
}: UseSeedsPlayerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const totalDurationRef = useRef(0);
  const seedBuffersRef = useRef<AudioBuffer[]>([]);
  const musicBufferRef = useRef<AudioBuffer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  const loadBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  };

  const buildTimeline = useCallback(() => {
    const buffers = seedBuffersRef.current;
    const events: { index: number; startOffset: number; duration: number }[] = [];
    if (buffers.length === 0) return { events, totalDuration };

    // Loop seeds across the full session duration.
    // Stop placing seeds early enough to leave a quiet fade-out tail.
    const seedWindowEnd = totalDuration - musicFadeOutDuration;
    let t = musicFadeInDuration;
    let i = 0;
    while (t < seedWindowEnd) {
      const buf = buffers[i % buffers.length];
      // Don't start a seed that wouldn't finish before the fade-out.
      if (t + buf.duration > seedWindowEnd) break;
      events.push({ index: i % buffers.length, startOffset: t, duration: buf.duration });
      t += buf.duration + pauseDuration;
      i++;
    }
    return { events, totalDuration };
  }, [musicFadeInDuration, pauseDuration, totalDuration, musicFadeOutDuration]);

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
    const buffers = seedBuffersRef.current;
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

    // Music
    if (musicBuf) {
      const musicSource = ctx.createBufferSource();
      musicSource.buffer = musicBuf;
      musicSource.loop = true;
      const gainNode = ctx.createGain();

      let currentGain = musicVolume;
      if (clampedOffset < musicFadeInDuration) {
        currentGain = (clampedOffset / musicFadeInDuration) * musicVolume;
      }
      const fadeOutStart = totalDuration - musicFadeOutDuration;
      if (clampedOffset >= fadeOutStart) {
        currentGain = Math.max(0, ((totalDuration - clampedOffset) / musicFadeOutDuration) * musicVolume);
      }

      gainNode.gain.setValueAtTime(currentGain, now);

      if (clampedOffset < musicFadeInDuration) {
        const remainFade = musicFadeInDuration - clampedOffset;
        gainNode.gain.linearRampToValueAtTime(musicVolume, now + remainFade);
      }

      const fadeOutStartOffset = totalDuration - musicFadeOutDuration;
      if (clampedOffset < fadeOutStartOffset) {
        const fadeOutAt = now + (fadeOutStartOffset - clampedOffset);
        gainNode.gain.setValueAtTime(musicVolume, fadeOutAt);
        gainNode.gain.linearRampToValueAtTime(0, fadeOutAt + musicFadeOutDuration);
      } else if (clampedOffset < totalDuration) {
        const remaining = totalDuration - clampedOffset;
        gainNode.gain.linearRampToValueAtTime(0, now + remaining);
      }

      musicSource.connect(gainNode).connect(ctx.destination);
      musicSource.start(now, clampedOffset % musicBuf.duration);
      musicSourceRef.current = musicSource;
      musicGainRef.current = gainNode;
      activeSourcesRef.current.push(musicSource);

      const musicStopAt = now + (totalDuration - clampedOffset) + 0.1;
      musicSource.stop(musicStopAt);
    }

    // Seeds
    events.forEach((evt) => {
      const segEnd = evt.startOffset + evt.duration;
      if (segEnd <= clampedOffset) return;

      const source = ctx.createBufferSource();
      source.buffer = buffers[evt.index];
      const gain = ctx.createGain();
      gain.gain.value = seedVolume;
      source.connect(gain).connect(ctx.destination);

      if (clampedOffset > evt.startOffset) {
        const skipInto = clampedOffset - evt.startOffset;
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
  }, [musicVolume, musicFadeInDuration, musicFadeOutDuration, buildTimeline, tick]);

  const play = useCallback(async () => {
    if (seedAudioUrls.filter(Boolean).length === 0) return;

    setIsLoading(true);
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      seedBuffersRef.current = await Promise.all(
        seedAudioUrls.filter(Boolean).map((url) => loadBuffer(ctx, url))
      );

      if (musicUrl) {
        musicBufferRef.current = await loadBuffer(ctx, musicUrl);
      }

      setIsLoading(false);
      playFromOffset(0);
    } catch (e) {
      console.error("Seeds player error:", e);
      setIsLoading(false);
    }
  }, [seedAudioUrls, musicUrl, playFromOffset]);

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

  const stop = useCallback(() => {
    stopAllSources();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
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

    if (wasPlaying || isPaused) {
      playFromOffset(newPos);
    } else {
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

    if (wasPlaying || isPaused) {
      playFromOffset(newPos);
    } else {
      setCurrentTime(newPos);
      setProgress((newPos / totalDurationRef.current) * 100);
    }
  }, [isPlaying, isPaused, stopAllSources, playFromOffset]);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      play();
    }
  }, [isPlaying, isPaused, pause, resume, play]);

  useEffect(() => {
    return () => { stop(); };
  }, []);

  return {
    isPlaying, isPaused, isLoading, progress, currentTime, duration,
    hasStarted, togglePlay, stop, skipForward, skipBackward, seekTo,
  };
}
