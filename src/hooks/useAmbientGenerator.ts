import { useRef, useCallback } from "react";

interface AmbientConfig {
  baseFreq: number;
  secondFreq: number;
  thirdFreq: number;
  filterFreq: number;
  lfoRate: number;
  gainLevel: number;
}

const moodConfigs: Record<string, AmbientConfig> = {
  "deep-sleep": {
    baseFreq: 60,
    secondFreq: 90,
    thirdFreq: 120,
    filterFreq: 200,
    lfoRate: 0.05,
    gainLevel: 0.12,
  },
  "calm-mind": {
    baseFreq: 110,
    secondFreq: 165,
    thirdFreq: 220,
    filterFreq: 400,
    lfoRate: 0.08,
    gainLevel: 0.10,
  },
  "inner-peace": {
    baseFreq: 85,
    secondFreq: 128,
    thirdFreq: 170,
    filterFreq: 300,
    lfoRate: 0.06,
    gainLevel: 0.11,
  },
  confidence: {
    baseFreq: 130,
    secondFreq: 195,
    thirdFreq: 260,
    filterFreq: 500,
    lfoRate: 0.1,
    gainLevel: 0.10,
  },
};

export function useAmbientGenerator() {
  const nodesRef = useRef<{ oscillators: OscillatorNode[]; gains: GainNode[]; lfo: OscillatorNode | null }>({
    oscillators: [],
    gains: [],
    lfo: null,
  });

  const start = useCallback((ctx: AudioContext, destination: AudioNode, mood: string, volume: number) => {
    const config = moodConfigs[mood] || moodConfigs["deep-sleep"];
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(config.gainLevel * volume, now + 3);
    masterGain.connect(destination);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(config.filterFreq, now);
    filter.Q.setValueAtTime(1, now);
    filter.connect(masterGain);

    // LFO for gentle filter modulation
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.setValueAtTime(config.lfoRate, now);
    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(config.filterFreq * 0.3, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start(now);

    const freqs = [config.baseFreq, config.secondFreq, config.thirdFreq];
    const oscillators: OscillatorNode[] = [];
    const gains: GainNode[] = [];

    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      // Slight detune for warmth
      osc.detune.setValueAtTime((i - 1) * 3, now);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(1 / (i + 1), now);
      osc.connect(gain);
      gain.connect(filter);
      osc.start(now);

      oscillators.push(osc);
      gains.push(gain);
    });

    nodesRef.current = { oscillators, gains: [...gains, masterGain], lfo };

    return masterGain;
  }, []);

  const stop = useCallback((ctx: AudioContext) => {
    const { oscillators, gains, lfo } = nodesRef.current;
    const now = ctx.currentTime;

    gains.forEach((g) => {
      try {
        g.gain.linearRampToValueAtTime(0, now + 0.5);
      } catch {}
    });

    setTimeout(() => {
      oscillators.forEach((o) => { try { o.stop(); } catch {} });
      if (lfo) try { lfo.stop(); } catch {}
    }, 600);

    nodesRef.current = { oscillators: [], gains: [], lfo: null };
  }, []);

  return { start, stop };
}
