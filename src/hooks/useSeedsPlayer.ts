import { useRef, useState, useCallback, useEffect } from "react";
import { createReverb } from "@/lib/audioEffects";

/**
 * 45-minute Evening Seeds session.
 *
 * Structure:
 *   0:00 → music fade-in (4s) then music alone for ~2 min
 *   Cycle 1: seeds 1→5 in fixed order. Seed vol 1.0. Music under seed 0.20, gap 0.35.
 *   Cycle 2: shuffled. Seed vol 0.95.
 *   Cycle 3: shuffled. Seed vol 0.85.
 *   Cycle 4: shuffled. Seed vol 0.70. Music under seed 0.15, gap 0.28. Gaps 100s.
 *   Final: music alone, 90-second slow fade to silence.
 *
 * Each seed is followed by 3s silence then 90s (or 100s in cycle 4) of music alone.
 * The shuffle for each new cycle never starts with the previous cycle's last seed.
 */

interface UseSeedsPlayerOptions {
  seedAudioUrls: string[];
  musicUrl: string | null;
  /** Total session length in seconds. Defaults to 45 minutes. */
  totalDuration?: number;
}

const PRELUDE_SECONDS = 120;        // music alone before any seed
const FADE_IN_SECONDS = 4;
const POST_SEED_SILENCE = 3;
const GAP_NORMAL = 90;
const GAP_DEEP = 100;
const FINAL_FADE_SECONDS = 90;

// Seeds are SUBLIMINAL WHISPERS — they should feel like thoughts arising from
// inside the music, never like someone speaking. Voice sits well beneath the
// music at all times and is piped through heavy reverb + a lowpass filter
// so it reads as distant and ethereal. Previous values (0.45 → 0.28) were
// far too loud and sounded like narration instead of whispers.
const CYCLE_SEED_VOLUMES = [0.22, 0.19, 0.16, 0.13];
const CYCLE_MUSIC_UNDER  = [0.28, 0.26, 0.24, 0.22]; // music barely ducks — the seed is the soft thing
const CYCLE_MUSIC_GAP    = [0.34, 0.32, 0.30, 0.26]; // music level between seeds
const CYCLE_GAP_SECONDS  = [GAP_NORMAL, GAP_NORMAL, GAP_NORMAL, GAP_DEEP];

// Voice-chain shaping for the whisper feel
const SEED_LOWPASS_HZ = 3200;   // rolls off sibilance — distant, not piercing
const SEED_REVERB_WET = 0.55;   // heavy wet — the seed blooms into the music
const SEED_REVERB_DRY = 0.70;

type SeedEvent = {
  index: number;
  startOffset: number;
  duration: number;
  cycle: number; // 0..3
};

export function useSeedsPlayer({
  seedAudioUrls,
  musicUrl,
  totalDuration = 45 * 60,
}: UseSeedsPlayerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const musicGainRef = useRef<GainNode | null>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const totalDurationRef = useRef(totalDuration);
  const seedBuffersRef = useRef<AudioBuffer[]>([]);
  const musicBufferRef = useRef<AudioBuffer | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(totalDuration);
  const [hasStarted, setHasStarted] = useState(false);

  const loadBuffer = async (ctx: AudioContext, url: string): Promise<AudioBuffer> => {
    const resp = await fetch(url);
    const arrayBuf = await resp.arrayBuffer();
    return await ctx.decodeAudioData(arrayBuf);
  };

  /** Shuffle [0..n-1] in place, ensuring index 0 != avoidFirst. */
  const shuffleAvoiding = (n: number, avoidFirst: number | null): number[] => {
    const arr = Array.from({ length: n }, (_, k) => k);
    let attempts = 0;
    do {
      for (let k = arr.length - 1; k > 0; k--) {
        const j = Math.floor(Math.random() * (k + 1));
        [arr[k], arr[j]] = [arr[j], arr[k]];
      }
      attempts++;
    } while (avoidFirst !== null && n > 1 && arr[0] === avoidFirst && attempts < 10);
    if (avoidFirst !== null && n > 1 && arr[0] === avoidFirst) {
      [arr[0], arr[1]] = [arr[1], arr[0]];
    }
    return arr;
  };

  /** Build the four-cycle timeline. Returns events + gap windows for music ducking. */
  const buildTimeline = useCallback(() => {
    const buffers = seedBuffersRef.current;
    const events: SeedEvent[] = [];
    if (buffers.length === 0) {
      return { events, gapWindows: [] as { start: number; end: number; cycle: number }[] };
    }
    const n = buffers.length;
    let t = FADE_IN_SECONDS + (PRELUDE_SECONDS - FADE_IN_SECONDS); // = PRELUDE_SECONDS
    const sessionEnd = totalDuration - FINAL_FADE_SECONDS;
    const gapWindows: { start: number; end: number; cycle: number }[] = [];

    let lastIdx: number | null = null;

    for (let cycle = 0; cycle < 4 && t < sessionEnd; cycle++) {
      const order = cycle === 0
        ? [0, 1, 2, 3, 4].slice(0, n)
        : shuffleAvoiding(n, lastIdx);
      const gap = CYCLE_GAP_SECONDS[cycle];

      for (let p = 0; p < order.length && t < sessionEnd; p++) {
        const idx = order[p];
        const buf = buffers[idx];
        if (t + buf.duration > sessionEnd) break;

        events.push({ index: idx, startOffset: t, duration: buf.duration, cycle });
        t += buf.duration;

        // 3s silence after seed (music continues at "under seed" level briefly,
        // then transitions to gap level for the rest of the gap window).
        const gapStart = t + POST_SEED_SILENCE;
        const gapEnd = Math.min(gapStart + gap, sessionEnd);
        gapWindows.push({ start: t, end: gapEnd, cycle });
        t = gapEnd;
        lastIdx = idx;
      }
    }

    return { events, gapWindows };
  }, [totalDuration]);

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

  const playFromOffset = useCallback(async (fromOffset: number) => {
    const ctx = audioCtxRef.current;
    const buffers = seedBuffersRef.current;
    const musicBuf = musicBufferRef.current;
    if (!ctx || buffers.length === 0) return;

    if (ctx.state === "suspended") await ctx.resume();

    const { events } = buildTimeline();
    totalDurationRef.current = totalDuration;
    setDuration(totalDuration);

    const clamped = Math.max(0, Math.min(fromOffset, totalDuration));
    offsetRef.current = clamped;

    const now = ctx.currentTime;
    startTimeRef.current = now;

    // ---------- Shared reverb for the session ----------
    const reverb = createReverb(ctx, 5.0, 2.4);
    reverb.output.connect(ctx.destination);

    // ---------- MUSIC + DUCKING SCHEDULE ----------
    if (musicBuf) {
      const musicSource = ctx.createBufferSource();
      musicSource.buffer = musicBuf;
      musicSource.loop = true;
      const gain = ctx.createGain();

      // Default music level when no seed is playing (gap level for the current cycle,
      // or the prelude / final-fade levels).
      const baseGapLevel = (sessionTime: number): number => {
        if (sessionTime < PRELUDE_SECONDS) return CYCLE_MUSIC_GAP[0];
        // find which cycle this time falls into via events
        let cycle = 3;
        for (const evt of events) {
          if (sessionTime <= evt.startOffset + evt.duration + POST_SEED_SILENCE + CYCLE_GAP_SECONDS[evt.cycle]) {
            cycle = evt.cycle;
            break;
          }
        }
        return CYCLE_MUSIC_GAP[cycle];
      };

      const startGain = (() => {
        if (clamped < FADE_IN_SECONDS) return 0;
        return baseGapLevel(clamped);
      })();
      gain.gain.setValueAtTime(startGain, now);

      // Initial fade-in
      if (clamped < FADE_IN_SECONDS) {
        gain.gain.linearRampToValueAtTime(baseGapLevel(FADE_IN_SECONDS), now + (FADE_IN_SECONDS - clamped));
      }

      // For each seed in the future, duck music down before, restore after.
      events.forEach((evt) => {
        const seedEnd = evt.startOffset + evt.duration;
        if (seedEnd <= clamped) return;
        const duckDown = CYCLE_MUSIC_UNDER[evt.cycle];
        const gapLevel = CYCLE_MUSIC_GAP[evt.cycle];

        const duckStartAbs = Math.max(evt.startOffset - 2, clamped);
        const duckEndAbs = seedEnd; // restore begins after the seed audio finishes
        const restoreEndAbs = seedEnd + POST_SEED_SILENCE + 8; // smooth ramp back over ~8s after silence

        if (duckStartAbs > clamped) {
          gain.gain.setValueAtTime(gapLevel, now + (duckStartAbs - clamped));
          gain.gain.linearRampToValueAtTime(duckDown, now + (evt.startOffset - clamped));
        } else {
          gain.gain.linearRampToValueAtTime(duckDown, now + Math.max(0.1, evt.startOffset - clamped));
        }
        gain.gain.setValueAtTime(duckDown, now + (duckEndAbs - clamped));
        gain.gain.linearRampToValueAtTime(gapLevel, now + (restoreEndAbs - clamped));
      });

      // Final 90s fade to silence.
      const fadeOutStart = totalDuration - FINAL_FADE_SECONDS;
      if (clamped < fadeOutStart) {
        gain.gain.setValueAtTime(CYCLE_MUSIC_GAP[3], now + (fadeOutStart - clamped));
        gain.gain.linearRampToValueAtTime(0, now + (totalDuration - clamped));
      } else {
        const remaining = totalDuration - clamped;
        gain.gain.linearRampToValueAtTime(0, now + remaining);
      }

      musicSource.connect(gain).connect(ctx.destination);
      musicSource.start(now, clamped % musicBuf.duration);
      musicSourceRef.current = musicSource;
      musicGainRef.current = gain;
      activeSourcesRef.current.push(musicSource);
      musicSource.stop(now + (totalDuration - clamped) + 0.1);
    }

    // ---------- SEEDS (whisper chain: LP filter → dry + reverb send) ----------
    events.forEach((evt) => {
      const segEnd = evt.startOffset + evt.duration;
      if (segEnd <= clamped) return;

      const seedLevel = CYCLE_SEED_VOLUMES[evt.cycle];

      const source = ctx.createBufferSource();
      source.buffer = buffers[evt.index];

      // Lowpass — rolls off sibilance and distance-filters the whisper
      const lpf = ctx.createBiquadFilter();
      lpf.type = "lowpass";
      lpf.frequency.value = SEED_LOWPASS_HZ;
      lpf.Q.value = 0.5;

      // Subtle low-shelf cut — keeps whispers airy, not muddy
      const lowShelf = ctx.createBiquadFilter();
      lowShelf.type = "highpass";
      lowShelf.frequency.value = 140;

      const dryGain = ctx.createGain();
      dryGain.gain.value = seedLevel * SEED_REVERB_DRY;
      const wetGain = ctx.createGain();
      wetGain.gain.value = seedLevel * SEED_REVERB_WET;

      source.connect(lpf);
      lpf.connect(lowShelf);
      lowShelf.connect(dryGain);
      lowShelf.connect(wetGain);
      dryGain.connect(ctx.destination);
      wetGain.connect(reverb.input);

      if (clamped > evt.startOffset) {
        const skipInto = clamped - evt.startOffset;
        source.start(now, skipInto);
      } else {
        const delay = evt.startOffset - clamped;
        source.start(now + delay);
      }
      activeSourcesRef.current.push(source);
    });

    setIsPlaying(true);
    setIsPaused(false);
    setHasStarted(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [buildTimeline, totalDuration, tick]);

  const play = useCallback(async () => {
    if (seedAudioUrls.filter(Boolean).length === 0) return;
    setIsLoading(true);
    try {
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      // Load seeds; skip any individual failures silently.
      const settled = await Promise.allSettled(
        seedAudioUrls.filter(Boolean).map((url) => loadBuffer(ctx, url))
      );
      seedBuffersRef.current = settled
        .filter((r): r is PromiseFulfilledResult<AudioBuffer> => r.status === "fulfilled")
        .map((r) => r.value);

      if (musicUrl) {
        try {
          musicBufferRef.current = await loadBuffer(ctx, musicUrl);
        } catch (e) {
          console.warn("Music failed to load — playing seeds in silence.", e);
          musicBufferRef.current = null;
        }
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
    // Capture refs NOW — the 1s fade timeout must close the context that was
    // playing at the moment stop() was called, not whatever context exists a
    // second later (which could be a new one if the user taps Play again quickly).
    const gain = musicGainRef.current;
    const ctx = audioCtxRef.current;
    const sourcesToStop = activeSourcesRef.current.slice();
    const musicSrc = musicSourceRef.current;

    if (gain && ctx) {
      try {
        const now = ctx.currentTime;
        gain.gain.cancelScheduledValues(now);
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 1);
      } catch {}
    }

    // Mark as stopped immediately so UI updates and new play can start
    setIsPlaying(false);
    setIsPaused(false);
    setHasStarted(false);
    setProgress(0);
    setCurrentTime(0);
    offsetRef.current = 0;
    activeSourcesRef.current = [];
    musicSourceRef.current = null;
    musicGainRef.current = null;
    cancelAnimationFrame(rafRef.current);

    // Close the captured (old) context after the fade, not the current ref
    setTimeout(() => {
      sourcesToStop.forEach((s) => { try { s.stop(); } catch {} });
      try { musicSrc?.stop(); } catch {}
      try { ctx?.close(); } catch {}
      // Only null the ref if it still points to the context we just closed
      if (audioCtxRef.current === ctx) audioCtxRef.current = null;
    }, 1000);
  }, []);

  const seekTo = useCallback((t: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlaying;
    const newPos = Math.max(0, Math.min(t, totalDurationRef.current));
    stopAllSources();
    // Reuse existing context — same reason as useSeedsPlayer.stop(): creating a
    // new AudioContext here would orphan the already-decoded seed buffers.
    if (ctx.state === "suspended") ctx.resume();
    offsetRef.current = newPos;
    if (wasPlaying || isPaused) playFromOffset(newPos);
    else { setCurrentTime(newPos); setProgress((newPos / totalDurationRef.current) * 100); }
  }, [isPlaying, isPaused, stopAllSources, playFromOffset]);

  const skipForward = useCallback(() => seekTo(currentTime + 30), [seekTo, currentTime]);
  const skipBackward = useCallback(() => seekTo(currentTime - 30), [seekTo, currentTime]);

  const togglePlay = useCallback(() => {
    if (isPlaying) pause();
    else if (isPaused) resume();
    else play();
  }, [isPlaying, isPaused, pause, resume, play]);

  useEffect(() => {
    return () => { stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    isPlaying, isPaused, isLoading, progress, currentTime, duration,
    hasStarted, togglePlay, stop, skipForward, skipBackward, seekTo,
  };
}
