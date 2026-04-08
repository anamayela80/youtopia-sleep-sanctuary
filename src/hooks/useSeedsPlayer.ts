import { useRef, useState, useCallback, useEffect } from "react";

interface UseSeedsPlayerOptions {
  seedAudioUrls: string[];
  musicUrl: string | null;
  musicVolume?: number;
  pauseDuration?: number; // seconds between seeds
  musicLoopDuration?: number; // seconds of music loop after last seed
  musicFadeInDuration?: number;
  musicFadeOutDuration?: number;
}

export function useSeedsPlayer({
  seedAudioUrls,
  musicUrl,
  musicVolume = 0.3,
  pauseDuration = 25,
  musicLoopDuration = 1200, // 20 minutes
  musicFadeInDuration = 90,
  musicFadeOutDuration = 120,
}: UseSeedsPlayerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
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
      let scheduleTime = startTime;

      // Start music (looping)
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

      // Schedule seeds with pauses
      seedBuffers.forEach((buf, i) => {
        const source = ctx.createBufferSource();
        source.buffer = buf;
        const gain = ctx.createGain();
        gain.gain.value = 0.9; // Slightly under music, whisper rises from within
        source.connect(gain).connect(ctx.destination);
        source.start(scheduleTime);
        scheduleTime += buf.duration + pauseDuration;
      });

      // Music continues for loopDuration after last seed
      const musicEndTime = scheduleTime + musicLoopDuration;
      
      if (musicGainRef.current) {
        musicGainRef.current.gain.setValueAtTime(musicVolume, musicEndTime - musicFadeOutDuration);
        musicGainRef.current.gain.linearRampToValueAtTime(0, musicEndTime);
      }
      if (musicSourceRef.current) {
        musicSourceRef.current.stop(musicEndTime + 0.1);
      }

      const totalDuration = musicEndTime - startTime;
      setDuration(totalDuration);
      setIsLoading(false);
      setIsPlaying(true);

      const tick = () => {
        if (!ctx) return;
        const elapsed = ctx.currentTime - startTime;
        setCurrentTime(Math.min(elapsed, totalDuration));
        setProgress(Math.min((elapsed / totalDuration) * 100, 100));
        if (elapsed < totalDuration) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setIsPlaying(false);
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      console.error("Seeds player error:", e);
      setIsLoading(false);
    }
  }, [seedAudioUrls, musicUrl, musicVolume, pauseDuration, musicLoopDuration, musicFadeInDuration, musicFadeOutDuration]);

  const stop = useCallback(() => {
    try { musicSourceRef.current?.stop(); } catch {}
    cancelAnimationFrame(rafRef.current);
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) stop();
    else play();
  }, [isPlaying, stop, play]);

  useEffect(() => {
    return () => { stop(); };
  }, []);

  return { isPlaying, isLoading, progress, currentTime, duration, togglePlay, stop };
}
