import { useRef, useState, useCallback, useEffect } from "react";

interface UseSeedsPlayerOptions {
  seedAudioUrls: string[];
  musicUrl: string | null;
  musicVolume?: number;
  pauseDuration?: number;
  musicLoopDuration?: number;
  musicFadeInDuration?: number;
  musicFadeOutDuration?: number;
}

export function useSeedsPlayer({
  seedAudioUrls,
  musicUrl,
  musicVolume = 0.3,
  pauseDuration = 25,
  musicLoopDuration = 1200,
  musicFadeInDuration = 90,
  musicFadeOutDuration = 120,
}: UseSeedsPlayerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const totalDurationRef = useRef(0);

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

  const tick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = ctx.currentTime - startTimeRef.current;
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

  const play = useCallback(async () => {
    if (seedAudioUrls.filter(Boolean).length === 0) return;

    setIsLoading(true);
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const seedBuffers = await Promise.all(
        seedAudioUrls.filter(Boolean).map((url) => loadBuffer(ctx, url))
      );

      let musicBuffer: AudioBuffer | null = null;
      if (musicUrl) {
        musicBuffer = await loadBuffer(ctx, musicUrl);
      }

      const startTime = ctx.currentTime;
      startTimeRef.current = startTime;
      let scheduleTime = startTime;

      if (musicBuffer) {
        const musicSource = ctx.createBufferSource();
        musicSource.buffer = musicBuffer;
        musicSource.loop = true;
        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(musicVolume, startTime + musicFadeInDuration);
        musicSource.connect(gainNode).connect(ctx.destination);
        musicSource.start(startTime);
        musicSourceRef.current = musicSource;
        musicGainRef.current = gainNode;
      }

      scheduleTime += musicFadeInDuration;

      seedBuffers.forEach((buf) => {
        const source = ctx.createBufferSource();
        source.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = 0.9;
        source.connect(gain).connect(ctx.destination);
        source.start(scheduleTime);
        scheduleTime += buf.duration + pauseDuration;
      });

      const musicEndTime = scheduleTime + musicLoopDuration;
      
      if (musicGainRef.current) {
        musicGainRef.current.gain.setValueAtTime(musicVolume, musicEndTime - musicFadeOutDuration);
        musicGainRef.current.gain.linearRampToValueAtTime(0, musicEndTime);
      }
      if (musicSourceRef.current) {
        musicSourceRef.current.stop(musicEndTime + 0.1);
      }

      const totalDuration = musicEndTime - startTime;
      totalDurationRef.current = totalDuration;
      setDuration(totalDuration);
      setIsLoading(false);
      setIsPlaying(true);
      setIsPaused(false);
      setHasStarted(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error("Seeds player error:", e);
      setIsLoading(false);
    }
  }, [seedAudioUrls, musicUrl, musicVolume, pauseDuration, musicLoopDuration, musicFadeInDuration, musicFadeOutDuration, tick]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "running") return;
    ctx.suspend();
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    setIsPaused(true);
  }, []);

  const resume = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || ctx.state !== "suspended") return;
    ctx.resume();
    setIsPlaying(true);
    setIsPaused(false);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    try { musicSourceRef.current?.stop(); } catch {}
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
    setIsPaused(false);
    setProgress(0);
    setCurrentTime(0);
    setHasStarted(false);
  }, []);

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

  return { isPlaying, isPaused, isLoading, progress, currentTime, duration, hasStarted, togglePlay, stop };
}
