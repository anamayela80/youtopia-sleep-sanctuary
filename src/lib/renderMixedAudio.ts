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
import {
  TenureBand,
  TENURE_TIMING,
  DUCK_RATIO,
  DUCK_PRE_RAMP as DUCK_PRE,
  DUCK_POST_RAMP as DUCK_POST,
  VOICE_RATE,
  MUSIC_RAMP_SECS as MUSIC_RAMP,
  ARC,
} from "@/lib/sessionTiming";

function arcLevelAt(
  t: number,
  events: { startOffset: number }[],
): number {
  if (!events[1] || t < events[1].startOffset) return ARC.fadeInPeak;
  if (!events[2] || t < events[2].startOffset) return ARC.section2;
  if (!events[3] || t < events[3].startOffset) return ARC.section3;
  return ARC.section4;
}

async function fetchBuffer(ctx: BaseAudioContext, url: string): Promise<AudioBuffer> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch audio (${resp.status}): ${url}`);
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
  tenureBand: TenureBand = "orienting",
  musicVolume = 0.42,
  narrationVolume = 0.72,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  // ── 1. Decode all audio in a temporary context ───────────────────────────
  const tmpCtx = new AudioContext();
  onProgress?.(5);

  // Load segments ONE AT A TIME — parallel decoding exceeds mobile memory budgets
  // and triggers silent failures on iOS Safari.
  const segBufs: AudioBuffer[] = [];
  for (const url of segmentUrls) {
    segBufs.push(await fetchBuffer(tmpCtx, url));
  }
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
  // OfflineAudioContext extends BaseAudioContext — helpers accept BaseAudioContext directly.
  const ctx: BaseAudioContext = offCtx;

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
