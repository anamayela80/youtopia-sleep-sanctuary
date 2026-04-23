/**
 * Shared Web Audio primitives for Youtopia's meditation audio system.
 *
 * The goal: make voice and music feel like ONE sonic space, not two tracks.
 * This is achieved via:
 *   1. A generated convolver reverb (warm tail, ~4s)
 *   2. A voice bus that sends part of the voice into the reverb so it blooms
 *      into the same "room" as the music
 *   3. A lowpass filter on the voice for softness (cuts sibilant harshness)
 *   4. Ducking helpers that automate music volume to dip under voice
 */

/**
 * Generate a warm, cathedral-like impulse response in-memory — no audio file
 * needed. Exponentially decaying white noise through a soft filter.
 *
 * @param ctx      - an AudioContext
 * @param duration - IR length in seconds (3.5-5s for meditation warmth)
 * @param decay    - how quickly the tail decays (2.0 = normal, higher = faster)
 */
export function createReverbImpulse(
  ctx: AudioContext,
  duration = 4.0,
  decay = 2.2,
): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const impulse = ctx.createBuffer(2, length, sampleRate);

  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      const n = length - i;
      // Warm noise that decays exponentially — slight stereo decorrelation
      // gives the reverb a sense of space rather than a flat cloud.
      const rand = (Math.random() * 2 - 1) * 0.9;
      data[i] = rand * Math.pow(n / length, decay);
    }
  }
  return impulse;
}

/**
 * Create a shared reverb send node. Connect your voice / music through
 * `input`; take the reverberant output from `output`. Typically mixed back
 * with the dry signal at a 20-40% wet ratio.
 */
export function createReverb(ctx: AudioContext, duration = 4.0, decay = 2.2) {
  const convolver = ctx.createConvolver();
  convolver.buffer = createReverbImpulse(ctx, duration, decay);

  // High-shelf cut on reverb tail — removes harshness, keeps it warm
  const highCut = ctx.createBiquadFilter();
  highCut.type = "lowpass";
  highCut.frequency.value = 3200;
  highCut.Q.value = 0.7;

  convolver.connect(highCut);

  return { input: convolver, output: highCut };
}

/**
 * Build a voice processing chain:
 *   source → lowpass (softness) → [dryGain → dest] + [wetGain → reverb.input]
 *
 * Returns a single `input` node (AudioBufferSourceNode connects here) and
 * exposes the gains so the caller can automate ducking/volume.
 *
 * The lowpass at 4500Hz removes sibilant harshness without dulling clarity —
 * this is what makes the voice feel "inside" the music rather than on top.
 */
export function createVoiceBus(
  ctx: AudioContext,
  reverbInput: AudioNode,
  destination: AudioNode,
  opts: { dryLevel?: number; wetLevel?: number; lowpass?: number } = {},
) {
  const { dryLevel = 0.78, wetLevel = 0.32, lowpass = 4500 } = opts;

  const input = ctx.createGain();
  input.gain.value = 1.0;

  // Warmth filter — tames ElevenLabs sibilance
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lowpass;
  filter.Q.value = 0.5;

  // Subtle high-shelf reduction for silkier top end
  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 6000;
  highShelf.gain.value = -3;

  const dryGain = ctx.createGain();
  dryGain.gain.value = dryLevel;
  const wetGain = ctx.createGain();
  wetGain.gain.value = wetLevel;

  input.connect(filter);
  filter.connect(highShelf);
  highShelf.connect(dryGain);
  highShelf.connect(wetGain);
  dryGain.connect(destination);
  wetGain.connect(reverbInput);

  return { input, dryGain, wetGain, filter };
}

/**
 * Schedule a smooth music-volume dip ("duck") centered on a speech event.
 *
 *   pre-duck (1.5s ramp down)  │  at voice gain  │  post-restore (2.5s ramp up)
 *                   ┌──────────┐
 *  gapLevel  ──────┘          └──────────  gapLevel
 *                   voiceLevel
 *
 * `now` is ctx.currentTime, `voiceStartAbs` and `voiceEndAbs` are offsets
 * relative to the timeline origin (same units as `nowAbs`).
 */
export function scheduleDuck(
  musicGain: GainNode,
  ctxNow: number,
  voiceStartAbs: number,
  voiceEndAbs: number,
  nowAbs: number,
  gapLevel: number,
  voiceLevel: number,
  preRamp = 1.5,
  postRamp = 2.5,
) {
  const toCtx = (abs: number) => ctxNow + Math.max(0.01, abs - nowAbs);
  const duckStart = voiceStartAbs - preRamp;
  const duckEnd = voiceStartAbs;
  const restoreStart = voiceEndAbs;
  const restoreEnd = voiceEndAbs + postRamp;

  if (duckStart > nowAbs) {
    musicGain.gain.setValueAtTime(gapLevel, toCtx(duckStart));
  }
  musicGain.gain.linearRampToValueAtTime(voiceLevel, toCtx(duckEnd));
  musicGain.gain.setValueAtTime(voiceLevel, toCtx(restoreStart));
  musicGain.gain.linearRampToValueAtTime(gapLevel, toCtx(restoreEnd));
}
