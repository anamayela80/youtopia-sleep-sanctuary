import { useRef, useState, useCallback, useEffect } from "react";

interface UseSegmentedMixerOptions {
  segmentUrls: string[];
  musicUrl: string | null;
  musicBridgeDurations?: number[]; // seconds for each bridge between segments
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
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const schedulerRef = useRef<NodeJS.Timeout | null>(null);
  const rafRef = useRef<number>(0);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSegment, setCurrentSegment] = useState(0);

  const loadBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  };

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

        // Calculate total duration
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
      stop();
      audioCtxRef.current?.close();
    };
  }, [segmentUrls.join(","), musicUrl]);

  const playSequence = useCallback(() => {
    const ctx = audioCtxRef.current;
    const buffers = segmentBuffersRef.current;
    const musicBuf = musicBufferRef.current;
    if (!ctx || buffers.length === 0) return;

    if (ctx.state === "suspended") ctx.resume();

    const startTime = ctx.currentTime;
    let scheduleTime = startTime;

    // Start music (looping)
    if (musicBuf) {
      const musicSource = ctx.createBufferSource();
      musicSource.buffer = musicBuf;
      musicSource.loop = true;
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(musicVolume, startTime + musicFadeInDuration);
      musicSource.connect(gainNode).connect(ctx.destination);
      musicSource.start(startTime);
      musicSourceRef.current = musicSource;
      musicGainRef.current = gainNode;
    }

    // Schedule: fade-in music → segments interleaved with music bridges
    scheduleTime += musicFadeInDuration;

    buffers.forEach((buf, i) => {
      const source = ctx.createBufferSource();
      source.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.value = 1.0;
      source.connect(gain).connect(ctx.destination);
      source.start(scheduleTime);

      scheduleTime += buf.duration;
      if (i < buffers.length - 1) {
        scheduleTime += musicBridgeDurations[i + 1] || 60;
      }
    });

    // Fade out music
    const fadeOutStart = scheduleTime;
    const fadeOutEnd = fadeOutStart + musicFadeOutDuration;
    if (musicGainRef.current) {
      musicGainRef.current.gain.setValueAtTime(musicVolume, fadeOutStart);
      musicGainRef.current.gain.linearRampToValueAtTime(0, fadeOutEnd);
    }

    // Stop music after fade
    if (musicSourceRef.current) {
      musicSourceRef.current.stop(fadeOutEnd + 0.1);
    }

    const totalDuration = fadeOutEnd - startTime;
    setDuration(totalDuration);

    // Progress tracking
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
    setIsPlaying(true);
  }, [musicVolume, musicFadeInDuration, musicFadeOutDuration, musicBridgeDurations]);

  const stop = useCallback(() => {
    try { musicSourceRef.current?.stop(); } catch {}
    try { currentSourceRef.current?.stop(); } catch {}
    cancelAnimationFrame(rafRef.current);
    if (schedulerRef.current) clearTimeout(schedulerRef.current);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      stop();
    } else {
      playSequence();
    }
  }, [isPlaying, stop, playSequence]);

  return { isPlaying, isLoading, progress, currentTime, duration, currentSegment, togglePlay, stop };
}
