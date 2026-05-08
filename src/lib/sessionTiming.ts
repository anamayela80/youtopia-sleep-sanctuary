/**
 * Canonical session-timing and audio constants for the YOUtopia meditation
 * audio system.
 *
 * Both the live player (useSegmentedMixer) and the offline renderer
 * (renderMixedAudio) MUST import from here so the downloaded WAV file is
 * bit-for-bit identical to what the user hears in the app.
 *
 * DO NOT duplicate these values in any other file.
 */

export type TenureBand = "orienting" | "settling" | "established";

export const TENURE_TIMING: Record<TenureBand, { fadeIn: number; bridges: number[]; fadeOut: number }> = {
  orienting:   { fadeIn: 75,  bridges: [0, 150, 215, 90,  90,  120], fadeOut: 105 },
  settling:    { fadeIn: 75,  bridges: [0, 150, 210, 90,  75,  120], fadeOut: 75  },
  established: { fadeIn: 90,  bridges: [0, 210, 300, 120, 90,  150], fadeOut: 90  },
};

/** Music ducking depth under voice — music drops to this fraction of its arc level. */
export const DUCK_RATIO = 0.65;

/** Seconds to ramp music down before voice starts. */
export const DUCK_PRE_RAMP = 1.8;

/** Seconds to ramp music back up after voice ends. */
export const DUCK_POST_RAMP = 2.8;

/** Playback rate applied to all narration buffers — 0.98 adds breathing room. */
export const VOICE_RATE = 0.98;

/** Wet reverb send level for the voice bus. */
export const VOICE_WET = 0.30;

/** Lowpass cutoff for voice bus — tames ElevenLabs sibilance. */
export const VOICE_LPF = 4500;

/** Seconds for music to ramp from silence to peak after playback starts. */
export const MUSIC_RAMP_SECS = 8;

/** Music arc multipliers (relative to musicVolume). */
export const ARC = {
  fadeInPeak: 0.75,   // after fade-in / section 1
  section2:   0.85,   // gratitude rising
  section3:   1.00,   // vision / heart — peak
  section4:   0.70,   // return / anchor
} as const;
