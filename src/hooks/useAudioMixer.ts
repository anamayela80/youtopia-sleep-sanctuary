import { useRef, useState, useCallback, useEffect } from "react";
import { useAmbientGenerator } from "./useAmbientGenerator";

interface UseAudioMixerOptions {
  narrationUrl: string | null;
  musicMood?: string;
  musicVolume?: number; // 0-1, default 0.15
}

export function useAudioMixer({ narrationUrl, musicMood = "deep-sleep", musicVolume = 0.15 }: UseAudioMixerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const narrationSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const narrationBufferRef = useRef<AudioBuffer | null>(null);
  const startTimeRef = useRef(0);
  const pauseOffsetRef = useRef(0);
  const rafRef = useRef<number>(0);
  const ambientActiveRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const ambient = useAmbientGenerator();

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
    } catch (e) {
      console.error("Audio loading error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [narrationUrl]);

  useEffect(() => {
    load();
    return () => {
      stop();
      audioCtxRef.current?.close();
    };
  }, [narrationUrl]);

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
      // Stop ambient when narration ends
      if (audioCtxRef.current && ambientActiveRef.current) {
        ambient.stop(audioCtxRef.current);
        ambientActiveRef.current = false;
      }
    }
  }, [ambient]);

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

    // Start procedural ambient music
    ambient.start(ctx, ctx.destination, musicMood, musicVolume);
    ambientActiveRef.current = true;

    narSource.start(0, pauseOffsetRef.current);
    startTimeRef.current = ctx.currentTime;
    narSource.onended = () => {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
      if (audioCtxRef.current && ambientActiveRef.current) {
        ambient.stop(audioCtxRef.current);
        ambientActiveRef.current = false;
      }
    };

    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [musicMood, musicVolume, tick, ambient]);

  const pause = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = ctx.currentTime - startTimeRef.current + pauseOffsetRef.current;
    pauseOffsetRef.current = elapsed;
    try { narrationSourceRef.current?.stop(); } catch {}
    if (ambientActiveRef.current) {
      ambient.stop(ctx);
      ambientActiveRef.current = false;
    }
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
  }, [ambient]);

  const stop = useCallback(() => {
    try { narrationSourceRef.current?.stop(); } catch {}
    if (audioCtxRef.current && ambientActiveRef.current) {
      ambient.stop(audioCtxRef.current);
      ambientActiveRef.current = false;
    }
    cancelAnimationFrame(rafRef.current);
    pauseOffsetRef.current = 0;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, [ambient]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  return { isPlaying, isLoading, progress, currentTime, duration, togglePlay, stop };
}
