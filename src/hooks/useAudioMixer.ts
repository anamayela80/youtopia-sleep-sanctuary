import { useRef, useState, useCallback, useEffect } from "react";
import { useAmbientGenerator } from "./useAmbientGenerator";
import { createReverb, createVoiceBus } from "@/lib/audioEffects";

/**
 * Morning meditation mixer: AI voice over procedural ambient.
 *
 * Design principles:
 *   - Voice and ambient share the SAME reverb so they live in one sonic space.
 *   - Ambient volume follows an emotional arc (builds, peaks, settles) — the
 *     flatness of the old version is what made meditations feel lifeless.
 *   - Voice is routed through a lowpass + reverb send for warmth and depth.
 *   - Playback rate 0.97 adds subtle breathing room to phrases without
 *     sounding unnaturally slow.
 *   - Music automatically ducks under the voice (-5 dB) for clarity.
 */

interface UseAudioMixerOptions {
  narrationUrl: string | null;
  musicMood?: string;
  /** Peak ambient level during the vision plateau. 0-1, default 0.38 */
  musicVolume?: number;
}

// Voice balance (the "one-voice-in-a-room" feeling)
const VOICE_DRY = 0.62;
const VOICE_WET = 0.34;   // reverb send — blends voice into the music's room
const VOICE_RATE = 0.97;

// Ambient arc (proportions of musicVolume)
const ARC_START = 0.40;
const ARC_PEAK  = 1.00;
const ARC_OUT   = 0.55;

// Ducking
const DUCK_RATIO = 0.55;       // music drops to 55% of arc level under voice
const DUCK_RAMP_DOWN = 1.2;
const DUCK_RAMP_UP   = 2.4;

export function useAudioMixer({
  narrationUrl,
  musicMood = "deep-sleep",
  musicVolume = 0.38,
}: UseAudioMixerOptions) {
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
      // Slowed playback stretches the perceived duration
      setDuration(narrationBuffer.duration / VOICE_RATE);
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
    const dur = narrationBufferRef.current.duration / VOICE_RATE;
    setCurrentTime(Math.min(elapsed, dur));
    setProgress(Math.min((elapsed / dur) * 100, 100));
    if (elapsed < dur) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlaying(false);
      pauseOffsetRef.current = 0;
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

    const totalDur = narBuf.duration / VOICE_RATE;
    const now = ctx.currentTime;

    // ---------- Shared reverb ----------
    const reverb = createReverb(ctx, 4.2, 2.2);
    reverb.output.connect(ctx.destination);

    // ---------- Voice chain: source → lowpass → dry + reverb send ----------
    const voiceBus = createVoiceBus(ctx, reverb.input, ctx.destination, {
      dryLevel: VOICE_DRY,
      wetLevel: VOICE_WET,
      lowpass: 4500,
    });

    const narSource = ctx.createBufferSource();
    narSource.buffer = narBuf;
    narSource.playbackRate.value = VOICE_RATE;
    narSource.connect(voiceBus.input);
    narrationSourceRef.current = narSource;

    // ---------- Ambient chain with emotional arc + voice duck ----------
    // Signal flow: ambient generator → arcGain → duckGain → destination
    //                                            ↘ ambientSend → reverb
    const arcGain = ctx.createGain();
    const duckGain = ctx.createGain();
    duckGain.gain.value = 1.0;
    arcGain.connect(duckGain);
    duckGain.connect(ctx.destination);

    const ambientSend = ctx.createGain();
    ambientSend.gain.value = 0.12;
    ambientSend.connect(reverb.input);

    const ambientMerge = ctx.createGain();
    ambientMerge.connect(arcGain);
    ambientMerge.connect(ambientSend);

    ambient.start(ctx, ambientMerge, musicMood, 1.0);
    ambientActiveRef.current = true;

    // Emotional arc: start soft, bloom to peak at 30%, hold, resolve
    const remaining = totalDur - pauseOffsetRef.current;
    const peakAt = now + remaining * 0.30;
    const holdEnd = now + remaining * 0.75;
    const fadeEnd = now + remaining;

    arcGain.gain.setValueAtTime(musicVolume * ARC_START, now);
    arcGain.gain.linearRampToValueAtTime(musicVolume * ARC_PEAK, peakAt);
    arcGain.gain.linearRampToValueAtTime(musicVolume * ARC_PEAK * 0.92, holdEnd);
    arcGain.gain.linearRampToValueAtTime(musicVolume * ARC_OUT, fadeEnd);

    // Long-form duck: music drops once voice starts, restores at the end
    const duckStart = now + 2;                    // let music breathe first
    const duckSettled = duckStart + DUCK_RAMP_DOWN;
    const restoreStart = fadeEnd - 5;
    const restoreEnd = fadeEnd;

    duckGain.gain.setValueAtTime(1.0, duckStart);
    duckGain.gain.linearRampToValueAtTime(DUCK_RATIO, duckSettled);
    duckGain.gain.setValueAtTime(DUCK_RATIO, restoreStart);
    duckGain.gain.linearRampToValueAtTime(1.0, restoreEnd);

    narSource.start(0, pauseOffsetRef.current * VOICE_RATE);
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
