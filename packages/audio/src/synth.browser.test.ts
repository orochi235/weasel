import { describe, expect, it } from 'vitest';
import { partialPresets } from './synthVoice';
import { CENTER_GAIN, renderEngine } from './testing/renderEngine';
import {
  bandPower, centroid, octaveDensityDb, peaks, powerSpectrum, rms,
} from './testing/spectrum';

// The fake proves the wiring; these render it, which is the only place a filter
// that does nothing or a partial at the wrong frequency shows up.

const RATE = 48000;
const ms = (t: number) => Math.round((t / 1000) * RATE);

describe('noise voices in a real graph', () => {
  it('sounds at the noise RMS, and falls to silence after its release', async () => {
    const out = await renderEngine(0.5, (e) => {
      e.playNoise({ noise: 'white', duration: 200, envelope: { attack: 1, release: 50 } });
    });
    expect(rms(out, ms(20), ms(180)) / CENTER_GAIN).toBeCloseTo(0.25, 1);
    expect(rms(out, ms(260), ms(500))).toBe(0);
  });

  it('gives each color its slope: flat, -3 dB and -6 dB an octave', async () => {
    const slope: Record<string, number> = {};
    for (const noise of ['white', 'pink', 'brown'] as const) {
      const out = await renderEngine(1, (e) => { e.playNoise({ noise }); });
      const s = powerSpectrum(out.subarray(ms(20)), RATE);
      // Four octaves, 250 Hz to 4 kHz.
      slope[noise] = (octaveDensityDb(s, 4000) - octaveDensityDb(s, 250)) / 4;
    }
    expect(slope.white).toBeCloseTo(0, 0);
    expect(slope.pink).toBeCloseTo(-3, 0);
    expect(slope.brown).toBeCloseTo(-6, 0);
  });

  it('filters: a 500 Hz lowpass leaves 4 kHz far below 250 Hz', async () => {
    const out = await renderEngine(1, (e) => {
      e.playNoise({ noise: 'white', filter: { type: 'lowpass', frequency: 500, Q: 0.7 } });
    });
    const s = powerSpectrum(out.subarray(ms(20)), RATE);
    expect(octaveDensityDb(s, 250) - octaveDensityDb(s, 4000)).toBeGreaterThan(30);
  });

  it('sweeps the cutoff: a thump is bright at the strike and dark after it', async () => {
    const out = await renderEngine(0.4, (e) => {
      e.playNoise({
        noise: 'white',
        filter: {
          frequency: 150, amount: 6000,
          envelope: { attack: 0, decay: 60, sustain: 0 },
        },
      });
    });
    const early = centroid(powerSpectrum(out.subarray(0, ms(40)), RATE, 1024));
    const late = centroid(powerSpectrum(out.subarray(ms(150), ms(400)), RATE, 1024));
    expect(early).toBeGreaterThan(3 * late);
  });
});

describe('inharmonic voices in a real graph', () => {
  it('puts a spectral peak at every ratio, and none on the harmonic series', async () => {
    const out = await renderEngine(1, (e) => {
      e.playNote({
        pitch: 300,
        wave: { partials: [{ ratio: 1 }, { ratio: 1.71 }, { ratio: 2.43 }] },
      });
    });
    const s = powerSpectrum(out.subarray(ms(20)), RATE, 8192);
    const found = peaks(s, 3).sort((a, b) => a - b);
    expect(found).toHaveLength(3);
    [300, 513, 729].forEach((hz, i) => expect(Math.abs(found[i] - hz)).toBeLessThan(s.binHz));
    const onPartial = bandPower(s, 290, 310);
    expect(bandPower(s, 590, 610)).toBeLessThan(onPartial * 1e-4);
    expect(bandPower(s, 890, 910)).toBeLessThan(onPartial * 1e-4);
  });

  it('keeps the sum of the levels at the note gain', async () => {
    const out = await renderEngine(0.5, (e) => {
      e.playNote({ pitch: 220, wave: { partials: [{ ratio: 1, gain: 3 }, { ratio: 2.7, gain: 1 }] } });
    });
    // Sines at 0.75 and 0.25: RMS sqrt((0.75² + 0.25²) / 2).
    expect(rms(out, ms(20), ms(500)) / CENTER_GAIN).toBeCloseTo(Math.sqrt((0.5625 + 0.0625) / 2), 2);
  });

  it('decays each partial on its own time constant', async () => {
    const out = await renderEngine(0.6, (e) => {
      e.playNote({
        pitch: 400,
        wave: { partials: [{ ratio: 1 }, { ratio: 2.9, decay: 50 }] },
      });
    });
    const at = (from: number) => powerSpectrum(out.subarray(ms(from), ms(from + 100)), RATE, 4096);
    const a = at(50);
    const b = at(250);
    const fundamental = bandPower(b, 380, 420) / bandPower(a, 380, 420);
    const upper = bandPower(b, 1140, 1180) / bandPower(a, 1140, 1180);
    expect(fundamental).toBeCloseTo(1, 1);
    // Power falls as e^(-2t/τ): 200 ms on a 50 ms constant is e^-8.
    expect(Math.log(upper)).toBeCloseTo(-8, 0);
  });

  it('rings a preset through the same path', async () => {
    const out = await renderEngine(0.5, (e) => {
      e.playNote({ pitch: 440, wave: partialPresets.marimba, duration: 300 });
    });
    const s = powerSpectrum(out.subarray(0, ms(200)), RATE, 8192);
    expect(Math.abs(peaks(s, 1)[0] - 440)).toBeLessThan(s.binHz);
  });
});
