import { useRef, useState, useCallback, useEffect } from "react";

interface UseAudioMixerOptions {
  narrationUrl: string | null;
  musicUrl: string | null;
  musicVolume?: number; // 0-1, default 0.15
}

export function useAudioMixer({ narrationUrl, musicUrl, musicVolume = 0.15 }: UseAudioMixerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const narrationSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const narrationGainRef = useRef<GainNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const narrationBufferRef = useRef<AudioBuffer | null>(null);
  const musicBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const rafRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const loadBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  };

  const load = useCallback(async () => {
    if (!narrationUrl) return;
    setIsLoading(true);
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const narrationBuffer = await loadBuffer(ctx, narrationUrl);
      narrationBufferRef.current = narrationBuffer;
      setDuration(narrationBuffer.duration);

      if (musicUrl) {
        try {
          const mBuf = await loadBuffer(ctx, musicUrl);
          musicBufferRef.current = mBuf;
        } catch (e) {
          console.warn("Could not load music track:", e);
        }
      }
    } catch (e) {
      console.error("Audio loading error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [narrationUrl, musicUrl]);

  useEffect(() => {
    load();
    return () => {
      stop();
      audioCtxRef.current?.close();
    };
  }, [narrationUrl, musicUrl]);

  const tick = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx || !narrationBufferRef.current) return;
    const elapsed = ctx.currentTime - startTimeRef.current + pauseOffsetRef.current;
    const dur = narrationBufferRef.current.duration;
    setCurrentTime(Math.min(elapsed, dur));
    setProgress(Math.min((elapsed / dur) * 100, 100));
    if (elapsed < dur) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
    }
  }, []);

  const play = useCallback(() => {
    const ctx = audioCtxRef.current;
    const narBuf = narrationBufferRef.current;
    if (!ctx || !narBuf) return;

    if (ctx.state === "suspended") ctx.resume();

    // Narration
    const narSource = ctx.createBufferSource();
    narSource.buffer = narBuf;
    const narGain = ctx.createGain();
    narGain.gain.value = 1.0;
    narSource.connect(narGain).connect(ctx.destination);
    narrationSourceRef.current = narSource;
    narrationGainRef.current = narGain;

    // Music (loop behind narration)
    const musBuf = musicBufferRef.current;
    if (musBuf) {
      const musSource = ctx.createBufferSource();
      musSource.buffer = musBuf;
      musSource.loop = true;
      const musGain = ctx.createGain();
      musGain.gain.value = musicVolume;
      musSource.connect(musGain).connect(ctx.destination);
      musicSourceRef.current = musSource;
      musicGainRef.current = musGain;
      musSource.start(0, pauseOffsetRef.current % musBuf.duration);
    }

    narSource.start(0, pauseOffsetRef.current);
    startTimeRef.current = ctx.currentTime;
    narSource.onended = () => {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
      try { musicSourceRef.current?.stop(); } catch {}
    };

    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [musicVolume, tick]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = ctx.currentTime - startTimeRef.current + pauseOffsetRef.current;
    pauseOffsetRef.current = elapsed;
    try { narrationSourceRef.current?.stop(); } catch {}
    try { musicSourceRef.current?.stop(); } catch {}
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, []);

  const stop = useCallback(() => {
    try { narrationSourceRef.current?.stop(); } catch {}
    try { musicSourceRef.current?.stop(); } catch {}
    cancelAnimationFrame(rafRef.current);
    pauseOffsetRef.current = 0;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  return { isPlaying, isLoading, progress, currentTime, duration, togglePlay, stop };
}
