/**
 * Offline mixer — renders the full meditation (voice + music) to a single WAV.
 *
 * Replicates useSegmentedMixer exactly: same gain arc, same ducking, same
 * voice bus, same reverb. The result is bit-for-bit indistinguishable from
 * what the in-app player produces, just rendered faster than real-time.
 *
 * Render time: ~15-45 s for a 20-minute session depending on device.
 * Output:      44100 Hz stereo 16-bit WAV (~200 MB for 20 min).
 */

import { createReverb, createVoiceBus } from "@/lib/audioEffects";

type Tenure = "orienting" | "settling" | "established";

const VOICE_RATE  = 0.98;
const DUCK_RATIO  = 0.45;
const DUCK_PRE    = 1.8;
const DUCK_POST   = 2.8;
const MUSIC_RAMP  = 8;

const ARC = {
  fadeInPeak: 0.75,
  section2:   0.85,
  section3:   1.00,
  section4:   0.70,
};

const TENURE_TIMING: Record<Tenure, { fadeIn: number; bridges: number[]; fadeOut: number }> = {
  orienting:   { fadeIn: 60,  bridges: [0, 150, 210, 90,  60,  90],  fadeOut: 75  },
  settling:    { fadeIn: 75,  bridges: [0, 210, 270, 120, 90,  120], fadeOut: 90  },
  established: { fadeIn: 90,  bridges: [0, 270, 390, 150, 120, 150], fadeOut: 120 },
};

function arcLevelAt(
  t: number,
  events: { startOffset: number }[],
): number {
  if (!events[1] || t < events[1].startOffset) return ARC.fadeInPeak;
  if (!events[2] || t < events[2].startOffset) return ARC.section2;
  if (!events[3] || t < events[3].startOffset) return ARC.section3;
  return ARC.section4;
}

async function fetchBuffer(ctx: AudioContext, url: string): Promise<AudioBuffer> {
  const resp = await fetch(url);
  const arr  = await resp.arrayBuffer();
  return ctx.decodeAudioData(arr);
}

function audioBufferToWav(buf: AudioBuffer): Blob {
  const nCh  = buf.numberOfChannels;
  const sr   = buf.sampleRate;
  const nSmp = buf.length;
  const data = new DataView(new ArrayBuffer(44 + nSmp * nCh * 2));

  const w32 = (o: number, v: number) => data.setUint32(o, v, true);
  const w16 = (o: number, v: number) => data.setUint16(o, v, true);
  const wStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) data.setUint8(o + i, s.charCodeAt(i)); };

  wStr(0,  "RIFF"); w32(4, 36 + nSmp * nCh * 2);
  wStr(8,  "WAVE"); wStr(12, "fmt ");
  w32(16, 16);  w16(20, 1);  w16(22, nCh);
  w32(24, sr);  w32(28, sr * nCh * 2);  w16(32, nCh * 2);  w16(34, 16);
  wStr(36, "data"); w32(40, nSmp * nCh * 2);

  let off = 44;
  for (let i = 0; i < nSmp; i++) {
    for (let ch = 0; ch < nCh; ch++) {
      const s = Math.max(-1, Math.min(1, buf.getChannelData(ch)[i]));
      data.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      off += 2;
    }
  }
  return new Blob([data.buffer], { type: "audio/wav" });
}

export async function renderMixedAudio(
  segmentUrls: string[],
  musicUrl: string | null,
  tenureBand: Tenure = "orienting",
  musicVolume = 0.42,
  narrationVolume = 0.72,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  // ── 1. Decode all audio in a temporary context ───────────────────────────
  const tmpCtx = new AudioContext();
  onProgress?.(5);

  const segBufs = await Promise.all(segmentUrls.map((u) => fetchBuffer(tmpCtx, u)));
  onProgress?.(30);

  let musicBuf: AudioBuffer | null = null;
  if (musicUrl) {
    musicBuf = await fetchBuffer(tmpCtx, musicUrl);
  }
  onProgress?.(40);
  await tmpCtx.close();

  // ── 2. Build timeline ────────────────────────────────────────────────────
  const timing = TENURE_TIMING[tenureBand];
  type EvtEntry = { index: number; startOffset: number; duration: number };
  const events: EvtEntry[] = [];
  let t = timing.fadeIn;
  segBufs.forEach((buf, i) => {
    const dur = buf.duration / VOICE_RATE;
    events.push({ index: i, startOffset: t, duration: dur });
    t += dur;
    if (i < segBufs.length - 1) t += timing.bridges[i + 1] ?? 60;
  });
  const totalDuration = t + timing.fadeOut;

  // ── 3. Create OfflineAudioContext ────────────────────────────────────────
  const SR = 44100;
  const offCtx = new OfflineAudioContext(2, Math.ceil(totalDuration * SR), SR);
  // OfflineAudioContext extends BaseAudioContext — safe to cast for our helpers
  const ctx = offCtx as unknown as AudioContext;

  // ── 4. Reverb ────────────────────────────────────────────────────────────
  const reverb = createReverb(ctx, 4.5, 2.2);
  reverb.output.connect(offCtx.destination);

  // ── 5. Music chain ───────────────────────────────────────────────────────
  if (musicBuf) {
    const musicGain = offCtx.createGain();
    musicGain.connect(offCtx.destination);

    // Small reverb send so music and voice share the same "room"
    const musicSend = offCtx.createGain();
    musicSend.gain.value = 0.08;
    musicGain.connect(musicSend);
    musicSend.connect(reverb.input);

    // Gain arc
    musicGain.gain.setValueAtTime(0, 0);
    musicGain.gain.linearRampToValueAtTime(musicVolume * ARC.fadeInPeak, MUSIC_RAMP);

    if (events[1]) musicGain.gain.linearRampToValueAtTime(musicVolume * ARC.section2, events[1].startOffset - 10);
    if (events[2]) musicGain.gain.linearRampToValueAtTime(musicVolume * ARC.section3, events[2].startOffset - 10);
    if (events[3]) musicGain.gain.linearRampToValueAtTime(musicVolume * ARC.section4, events[3].startOffset - 10);

    // Per-segment ducking
    events.forEach((evt) => {
      const arcLevel  = musicVolume * arcLevelAt(evt.startOffset, events);
      const duckLevel = arcLevel * DUCK_RATIO;
      const duckStart = Math.max(0, evt.startOffset - DUCK_PRE);

      musicGain.gain.setValueAtTime(arcLevel, duckStart);
      musicGain.gain.linearRampToValueAtTime(duckLevel, evt.startOffset);
      musicGain.gain.setValueAtTime(duckLevel, evt.startOffset + evt.duration);
      musicGain.gain.linearRampToValueAtTime(arcLevel, evt.startOffset + evt.duration + DUCK_POST);
    });

    // Final fade-out
    musicGain.gain.linearRampToValueAtTime(0, totalDuration);

    // Loop music by scheduling chained source nodes
    const musicSrc = offCtx.createBufferSource();
    musicSrc.buffer  = musicBuf;
    musicSrc.loop    = true;
    musicSrc.connect(musicGain);
    musicSrc.start(0);
    musicSrc.stop(totalDuration);
  }

  // ── 6. Voice bus ─────────────────────────────────────────────────────────
  const voiceBus = createVoiceBus(ctx, reverb.input, offCtx.destination, {
    dryLevel: narrationVolume,
    wetLevel: 0.30,
    lowpass: 4500,
  });

  events.forEach((evt) => {
    const src = offCtx.createBufferSource();
    src.buffer            = segBufs[evt.index];
    src.playbackRate.value = VOICE_RATE;
    src.connect(voiceBus.input);
    src.start(evt.startOffset);
  });

  onProgress?.(50);

  // ── 7. Render (faster-than-real-time) ────────────────────────────────────
  const rendered = await offCtx.startRendering();
  onProgress?.(90);

  // ── 8. Encode to WAV ─────────────────────────────────────────────────────
  const wav = audioBufferToWav(rendered);
  onProgress?.(100);
  return wav;
}
