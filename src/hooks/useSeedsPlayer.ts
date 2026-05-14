import { useRef, useState, useCallback, useEffect } from "react";
import { createReverb } from "@/lib/audioEffects";
import { enableNativePlaybackSession, updateMediaSessionPosition, startAudioKeepalive, stopAudioKeepalive } from "@/lib/mobileAudioSession";

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

async function loadBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch audio (${resp.status}): ${url}`);
  const arrayBuf = await resp.arrayBuffer();
  return ctx.decodeAudioData(arrayBuf);
}

// Smoothly animate an <audio> element's volume over durationMs.
// Uses rAF so it's frame-accurate when the screen is active.
function fadeVol(el: HTMLAudioElement, targetVol: number, durationMs: number) {
  const startVol = el.volume;
  const target = Math.max(0, Math.min(1, targetVol));
  const startTime = performance.now();
  const step = () => {
    const t = Math.min((performance.now() - startTime) / durationMs, 1);
    el.volume = startVol + (target - startVol) * t;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function useSeedsPlayer({
  seedAudioUrls,
  musicUrl,
  totalDuration = 45 * 60,
}: UseSeedsPlayerOptions) {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const musicElementRef = useRef<HTMLAudioElement | null>(null);
  const duckTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef(0);
  const offsetRef = useRef(0);
  const totalDurationRef = useRef(totalDuration);
  const seedBuffersRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const tickRef = useRef<(() => void) | null>(null);
  const pauseRef = useRef<(() => void) | null>(null);
  const resumeRef = useRef<(() => void) | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(totalDuration);
  const [hasStarted, setHasStarted] = useState(false);

  const getPlaybackPosition = useCallback((ctx: AudioContext | null = audioCtxRef.current) => {
    const total = totalDurationRef.current;
    const elapsed = isPlayingRef.current && ctx
      ? offsetRef.current + Math.max(0, ctx.currentTime - startTimeRef.current)
      : offsetRef.current;
    return Math.min(Math.max(elapsed, 0), total || Math.max(elapsed, 0));
  }, []);

  /** Register a MediaSession so the OS lock screen knows we're playing audio
   *  and doesn't kill the AudioContext when the screen turns off. */
  const registerMediaSession = useCallback((
    onPlay: () => void,
    onPause: () => void,
  ) => {
    if (!("mediaSession" in navigator)) return;
    enableNativePlaybackSession();
    navigator.mediaSession.metadata = new MediaMetadata({
      title: "Evening Seeds",
      artist: "YOUtopia",
      album: "Nightly Practice",
    });
    try { navigator.mediaSession.setActionHandler("play", onPlay); } catch {}
    try { navigator.mediaSession.setActionHandler("pause", onPause); } catch {}
    navigator.mediaSession.playbackState = "playing";
  }, []);

  /** Keep lock-screen audio alive. On iOS, the AudioContext is suspended when
   *  the screen locks and all scheduled source nodes are dropped. On unlock,
   *  we detect the suspended context and re-schedule from the current position. */
  useEffect(() => {
    const keepSessionActive = () => {
      if (!isPlayingRef.current) return;

      if (document.visibilityState === "visible") {
        // Screen just unlocked — iOS suspends AudioContext on lock and drops all
        // scheduled source nodes. Re-create them from the correct current position.
        const ctx = audioCtxRef.current;
        if (ctx && ctx.state === "suspended") {
          resumeRef.current?.();
          return; // resumeRef restarts the rAF tick via playFromOffset
        }
      }

      enableNativePlaybackSession();
      if ("mediaSession" in navigator) {
        navigator.mediaSession.playbackState = "playing";
        updateMediaSessionPosition(totalDurationRef.current, getPlaybackPosition());
      }
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => tickRef.current?.());
    };
    document.addEventListener("visibilitychange", keepSessionActive);
    window.addEventListener("pagehide", keepSessionActive);
    window.addEventListener("pageshow", keepSessionActive);
    return () => {
      document.removeEventListener("visibilitychange", keepSessionActive);
      window.removeEventListener("pagehide", keepSessionActive);
      window.removeEventListener("pageshow", keepSessionActive);
    };
  }, [getPlaybackPosition]);

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
    let t = PRELUDE_SECONDS;
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
    const elapsed = getPlaybackPosition(ctx);
    const total = totalDurationRef.current;
    setCurrentTime(Math.min(elapsed, total));
    setProgress(Math.min((elapsed / total) * 100, 100));
    updateMediaSessionPosition(total, elapsed);
    if (elapsed < total) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [getPlaybackPosition]);
  tickRef.current = tick;

  const stopAllSources = useCallback(() => {
    activeSourcesRef.current.forEach((s) => { try { s.stop(); } catch {} });
    activeSourcesRef.current = [];
    duckTimersRef.current.forEach(clearTimeout);
    duckTimersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  }, []);

  const playFromOffset = useCallback(async (fromOffset: number) => {
    const ctx = audioCtxRef.current;
    const buffers = seedBuffersRef.current;
    if (!ctx || buffers.length === 0) return;

    enableNativePlaybackSession();
    if (ctx.state === "suspended") await ctx.resume();

    const { events } = buildTimeline();
    totalDurationRef.current = totalDuration;
    setDuration(totalDuration);

    const clamped = Math.max(0, Math.min(fromOffset, totalDuration));
    offsetRef.current = clamped;

    const now = ctx.currentTime;
    startTimeRef.current = now;

    // ---------- Shared reverb for the session (seeds only) ----------
    const reverb = createReverb(ctx, 5.0, 2.4);
    reverb.output.connect(ctx.destination);

    // ---------- MUSIC via <audio> element — survives iOS screen lock ----------
    // AudioBufferSourceNode is killed by iOS when the screen locks. A plain
    // <audio> element is handled by iOS's native media system (same as Spotify)
    // and keeps playing regardless of screen state.
    const musicEl = musicElementRef.current;
    if (musicEl) {
      // Cancel any pending duck/fade timers from a previous playFromOffset call
      duckTimersRef.current.forEach(clearTimeout);
      duckTimersRef.current = [];

      musicEl.pause();

      // Helper to resolve cycle-level gap volume for any session time
      const baseGapLevel = (sessionTime: number): number => {
        if (sessionTime < PRELUDE_SECONDS) return CYCLE_MUSIC_GAP[0];
        let cycle = 3;
        for (const evt of events) {
          if (sessionTime <= evt.startOffset + evt.duration + POST_SEED_SILENCE + CYCLE_GAP_SECONDS[evt.cycle]) {
            cycle = evt.cycle;
            break;
          }
        }
        return CYCLE_MUSIC_GAP[cycle];
      };

      const startVol = clamped < FADE_IN_SECONDS ? 0 : baseGapLevel(clamped);
      musicEl.volume = startVol;

      // Seek to the right position within the looping music file
      const startPlayback = () => {
        if (musicEl.duration) musicEl.currentTime = clamped % musicEl.duration;
        musicEl.play().catch(() => {});
        // Fade in if starting from the very beginning
        if (clamped < FADE_IN_SECONDS) {
          fadeVol(musicEl, baseGapLevel(FADE_IN_SECONDS), (FADE_IN_SECONDS - clamped) * 1000);
        }
      };
      if (musicEl.readyState >= 1) {
        startPlayback();
      } else {
        musicEl.addEventListener("loadedmetadata", startPlayback, { once: true });
      }

      // Schedule ducking with setTimeout — these fire when the screen is active.
      // When the screen is locked, seeds (AudioBufferSourceNode) also pause, so
      // there is nothing to duck anyway; music plays at gap level through the lock.
      events.forEach((evt) => {
        const seedEnd = evt.startOffset + evt.duration;
        if (seedEnd <= clamped) return;
        const duckDown = CYCLE_MUSIC_UNDER[evt.cycle];
        const gapLevel = CYCLE_MUSIC_GAP[evt.cycle];

        const duckMs = Math.max(0, (evt.startOffset - 2 - clamped) * 1000);
        const restoreMs = Math.max(0, (seedEnd + POST_SEED_SILENCE + 2 - clamped) * 1000);

        duckTimersRef.current.push(
          setTimeout(() => fadeVol(musicEl, duckDown, 1500), duckMs),
          setTimeout(() => fadeVol(musicEl, gapLevel, 2500), restoreMs),
        );
      });

      // Final 90-second fade to silence
      const fadeOutStart = totalDuration - FINAL_FADE_SECONDS;
      const fadeOutMs = Math.max(0, (fadeOutStart - clamped) * 1000);
      duckTimersRef.current.push(
        setTimeout(() => fadeVol(musicEl, 0, FINAL_FADE_SECONDS * 1000), fadeOutMs),
      );
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

    isPlayingRef.current = true;
    setIsPlaying(true);
    setIsPaused(false);
    setHasStarted(true);
    updateMediaSessionPosition(totalDuration, clamped);
    registerMediaSession(
      () => {
        const c = audioCtxRef.current;
        if (!c) return;
        void c.resume().then(() => {
          isPlayingRef.current = true;
          setIsPlaying(true);
          setIsPaused(false);
          navigator.mediaSession.playbackState = "playing";
        });
      },
      () => { pauseRef.current?.(); },
    );
    if ("mediaSession" in navigator) {
      // seekforward/seekbackward are a Chrome extension — not available on all
      // Android WebViews; wrap in try/catch so unsupported browsers don't throw.
      try {
        navigator.mediaSession.setActionHandler("seekforward", () => {
          const c = audioCtxRef.current;
          if (!c) return;
          const elapsed = getPlaybackPosition(c);
          const newPos = Math.min(elapsed + 30, totalDurationRef.current);
          stopAllSources();
          if (c.state === "suspended") void c.resume();
          offsetRef.current = newPos;
          playFromOffset(newPos);
        });
        navigator.mediaSession.setActionHandler("seekbackward", () => {
          const c = audioCtxRef.current;
          if (!c) return;
          const elapsed = getPlaybackPosition(c);
          const newPos = Math.max(elapsed - 30, 0);
          stopAllSources();
          if (c.state === "suspended") void c.resume();
          offsetRef.current = newPos;
          playFromOffset(newPos);
        });
      } catch {}
    }
    rafRef.current = requestAnimationFrame(tick);
  }, [buildTimeline, totalDuration, tick, registerMediaSession, stopAllSources, getPlaybackPosition]);

  const play = useCallback(async () => {
    const validUrls = seedAudioUrls.filter(Boolean);
    if (validUrls.length === 0) return;
    // Already loaded — jump straight to playback
    if (seedBuffersRef.current.length > 0) { playFromOffset(0); return; }
    // Already loading — prevent double-initialisation (second tap while loading)
    if (audioCtxRef.current) return;
    setIsLoading(true);
    try {
      enableNativePlaybackSession();
      // Start the silent keepalive BEFORE creating AudioContext — this registers
      // an active media element with iOS so the audio session stays alive when
      // the screen locks, keeping the AudioContext (and all Web Audio nodes:
      // voice, seeds, reverb) running continuously.
      startAudioKeepalive();
      const ctx = new AudioContext({ latencyHint: "playback" });
      audioCtxRef.current = ctx;

      // Load seeds ONE AT A TIME — parallel fetches exceed mobile memory budgets
      // and trigger silent failures on iOS Safari (no error, just hangs).
      const loaded: AudioBuffer[] = [];
      for (const url of validUrls) {
        try {
          loaded.push(await loadBuffer(ctx, url));
        } catch (e) {
          console.warn("Seed failed to load, skipping:", url, e);
        }
      }
      seedBuffersRef.current = loaded;

      if (musicUrl) {
        // Use a plain <audio> element — NOT AudioBufferSourceNode.
        // iOS keeps <audio> elements playing when the screen locks (same as
        // Spotify). AudioBufferSourceNode gets killed by iOS on screen lock.
        const el = new Audio(musicUrl);
        el.loop = true;
        el.crossOrigin = "anonymous";
        el.volume = 0;
        el.load();
        musicElementRef.current = el;
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
    offsetRef.current = getPlaybackPosition(ctx);
    ctx.suspend();
    musicElementRef.current?.pause();
    duckTimersRef.current.forEach(clearTimeout);
    duckTimersRef.current = [];
    cancelAnimationFrame(rafRef.current);
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(true);
    if ("mediaSession" in navigator) {
      navigator.mediaSession.playbackState = "paused";
      updateMediaSessionPosition(totalDurationRef.current, offsetRef.current);
    }
  }, [getPlaybackPosition]);
  pauseRef.current = pause;

  const resume = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    // Calculate the true playback position BEFORE stopping sources — offsetRef
    // is stale after a screen lock (it holds the start position, not elapsed
    // time). We capture the real position now, then re-schedule the entire
    // timeline from there so playback continues exactly where it was.
    const currentPos = getPlaybackPosition(ctx);
    offsetRef.current = currentPos;
    stopAllSources();
    playFromOffset(currentPos);
  }, [stopAllSources, playFromOffset, getPlaybackPosition]);
  resumeRef.current = resume;

  const stop = useCallback(() => {
    const ctx = audioCtxRef.current;
    const sourcesToStop = activeSourcesRef.current.slice();
    const musicEl = musicElementRef.current;

    // Fade music element out over 1s then stop it
    if (musicEl) {
      fadeVol(musicEl, 0, 1000);
    }

    // Mark as stopped immediately so UI updates and new play can start
    isPlayingRef.current = false;
    setIsPlaying(false);
    setIsPaused(false);
    setHasStarted(false);
    if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
    setProgress(0);
    setCurrentTime(0);
    offsetRef.current = 0;
    activeSourcesRef.current = [];
    duckTimersRef.current.forEach(clearTimeout);
    duckTimersRef.current = [];
    cancelAnimationFrame(rafRef.current);
    stopAudioKeepalive();

    setTimeout(() => {
      sourcesToStop.forEach((s) => { try { s.stop(); } catch {} });
      musicEl?.pause();
      if (musicElementRef.current === musicEl) musicElementRef.current = null;
      try { ctx?.close(); } catch {}
      if (audioCtxRef.current === ctx) audioCtxRef.current = null;
    }, 1100);
  }, []);

  const seekTo = useCallback((t: number) => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const wasPlaying = isPlayingRef.current;
    const newPos = Math.max(0, Math.min(t, totalDurationRef.current));
    stopAllSources();
    // Reuse existing context — same reason as useSeedsPlayer.stop(): creating a
    // new AudioContext here would orphan the already-decoded seed buffers.
    if (ctx.state === "suspended") void ctx.resume();
    offsetRef.current = newPos;
    if (wasPlaying || isPaused) playFromOffset(newPos);
    else { setCurrentTime(newPos); setProgress((newPos / totalDurationRef.current) * 100); }
  }, [isPaused, stopAllSources, playFromOffset]);

  // Read elapsed from refs (not React state) so these functions are stable
  // and don't change identity every rAF tick at 60fps.
  const skipForward = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = getPlaybackPosition(ctx);
    seekTo(Math.min(elapsed + 30, totalDurationRef.current));
  }, [seekTo, getPlaybackPosition]);

  const skipBackward = useCallback(() => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    const elapsed = getPlaybackPosition(ctx);
    seekTo(Math.max(elapsed - 30, 0));
  }, [seekTo, getPlaybackPosition]);

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
