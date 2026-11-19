import { describe, expect, it } from 'vitest';
import { createNoiseKernel, createNoteKernel, renderNoise, renderNote } from './voiceKernel';
import { bandPower, centroid, peaks, powerSpectrum, rms } from './testing/spectrum';

const RATE = 48000;
const ms = (t: number): number => Math.round((t * RATE) / 1000);
const FLAT = { attack: 0, decay: 0, sustain: 1, release: 0 };
const BIN = RATE / 2048;

/** Rising zero crossings a second, over `x[from..to)`. */
function crossingsHz(x: Float32Array, from: number, to: number): number {
  let count = 0;
  for (let i = from + 1; i < to; i += 1) if (x[i - 1] < 0 && x[i] >= 0) count += 1;
  return (count * RATE) / (to - from);
}

describe('renderNote', () => {
  it('sounds a sine at the pitch, for the gate and the release, at the gain', () => {
    const out = renderNote({ pitch: 'A4', duration: 400, envelope: { ...FLAT, release: 100 }, gain: 0.5 }, RATE);
    expect(out.length).toBe(ms(500));
    expect(Math.abs(peaks(powerSpectrum(out, RATE), 1)[0] - 440)).toBeLessThan(BIN);
    expect(rms(out, ms(100), ms(300))).toBeCloseTo(0.5 * Math.SQRT1_2, 2);
  });

  it('follows the envelope through attack, sustain, and release', () => {
    const envelope = { attack: 100, decay: 100, sustain: 0.5, release: 200 };
    const out = renderNote({ pitch: 1000, duration: 500, envelope }, RATE);
    const level = (at: number): number => rms(out, ms(at - 5), ms(at + 5)) * Math.SQRT2;
    expect(level(50)).toBeCloseTo(0.5, 1);
    expect(level(300)).toBeCloseTo(0.5, 2);
    expect(level(600)).toBeCloseTo(0.25, 1);
    expect(out[out.length - 1]).toBeCloseTo(0, 3);
  });

  it('needs a duration to know where to end', () => {
    expect(() => renderNote({ pitch: 440 }, RATE)).toThrow(/duration/);
  });

  it('throws on a bad pitch where the note is written', () => {
    expect(() => renderNote({ pitch: -1, duration: 10 }, RATE)).toThrow(RangeError);
  });

  it('keeps a square wave from folding back under its fundamental', () => {
    const out = renderNote({ pitch: 5000, wave: 'square', duration: 400, envelope: FLAT }, RATE);
    const naive = new Float32Array(out.length);
    for (let i = 0; i < naive.length; i += 1) naive[i] = (i * 5000) / RATE % 1 < 0.5 ? 1 : -1;
    // The ninth harmonic, at 45 kHz, folds to 3 kHz.
    const folded = (x: Float32Array): number => bandPower(powerSpectrum(x, RATE), 2900, 3100);
    expect(folded(out)).toBeLessThan(folded(naive) / 10);
    expect(Math.abs(peaks(powerSpectrum(out, RATE), 1)[0] - 5000)).toBeLessThan(BIN);
  });

  it('keeps a triangle wave from folding back too', () => {
    const out = renderNote({ pitch: 5000, wave: 'triangle', duration: 400, envelope: FLAT }, RATE);
    const naive = new Float32Array(out.length);
    for (let i = 0; i < naive.length; i += 1) {
      const p = (i * 5000) / RATE % 1;
      naive[i] = p < 0.25 ? 4 * p : p < 0.75 ? 2 - 4 * p : 4 * p - 4;
    }
    const folded = (x: Float32Array): number => bandPower(powerSpectrum(x, RATE), 2900, 3100);
    expect(folded(out)).toBeLessThan(folded(naive) / 10);
  });

  it('gives a sawtooth every harmonic and a triangle only the odd ones', () => {
    const power = (wave: 'sawtooth' | 'triangle', hz: number): number => bandPower(
      powerSpectrum(renderNote({ pitch: 500, wave, duration: 400, envelope: FLAT }, RATE), RATE), hz - 60, hz + 60,
    );
    expect(power('sawtooth', 1000)).toBeGreaterThan(power('sawtooth', 500) / 8);
    expect(power('triangle', 1000)).toBeLessThan(power('triangle', 500) / 1000);
    expect(power('triangle', 1500)).toBeGreaterThan(power('triangle', 500) / 200);
  });

  it('plays harmonic levels as partials, scaled to peak at the gain', () => {
    const out = renderNote({ pitch: 400, wave: [1, 0, 0.5], duration: 400, envelope: FLAT }, RATE);
    const found = peaks(powerSpectrum(out, RATE), 2);
    expect(Math.abs(found[0] - 400)).toBeLessThan(BIN);
    expect(Math.abs(found[1] - 1200)).toBeLessThan(BIN);
    let peak = 0;
    for (const v of out) peak = Math.max(peak, Math.abs(v));
    expect(peak).toBeGreaterThan(0.97);
    expect(peak).toBeLessThanOrEqual(1.001);
  });

  it('drops a harmonic that would land past Nyquist', () => {
    const out = renderNote({ pitch: 10000, wave: [1, 0, 0, 1], duration: 200, envelope: FLAT }, RATE);
    // The fourth harmonic, at 40 kHz, would fold to 8 kHz.
    const s = powerSpectrum(out, RATE);
    expect(bandPower(s, 7900, 8100)).toBeLessThan(bandPower(s, 9900, 10100) / 1e6);
  });

  it('sums inharmonic partials at their ratios, each on its own decay', () => {
    const wave = { partials: [{ ratio: 1, decay: 100 }, { ratio: 2.5 }] };
    const out = renderNote({ pitch: 400, wave, duration: 600, envelope: FLAT }, RATE);
    const early = powerSpectrum(out.subarray(0, ms(100)), RATE);
    const late = powerSpectrum(out.subarray(ms(500), ms(600)), RATE);
    const at = (s: typeof early, hz: number): number => bandPower(s, hz - 60, hz + 60);
    expect(at(late, 1000) / at(early, 1000)).toBeGreaterThan(0.9);
    expect(at(late, 1000) / at(early, 1000)).toBeLessThan(1.1);
    // Five time constants: e^-5 in level, e^-10 in power, against the first one's average.
    expect(at(late, 400)).toBeLessThan(at(early, 400) / 1000);
  });

  it('glides evenly in pitch by default and evenly in hertz when asked', () => {
    const base = { pitch: 200, duration: 2000, envelope: FLAT };
    const middle = (curve?: 'linear'): number => {
      const out = renderNote({ ...base, glide: { to: 800, curve } }, RATE);
      return crossingsHz(out, ms(950), ms(1050));
    };
    expect(middle()).toBeGreaterThan(380);
    expect(middle()).toBeLessThan(420);
    expect(middle('linear')).toBeGreaterThan(480);
    expect(middle('linear')).toBeLessThan(520);
  });

  it('retunes by cents', () => {
    const out = renderNote({ pitch: 300, detune: 1200, duration: 300, envelope: FLAT }, RATE);
    expect(crossingsHz(out, 0, out.length)).toBeCloseTo(600, -1);
  });

  it('sweeps a filter cutoff with its own envelope', () => {
    const filter = { frequency: 200, amount: 6000, envelope: { attack: 0, decay: 150, sustain: 0, release: 0 } };
    const out = renderNote({ pitch: 110, wave: 'sawtooth', duration: 400, envelope: FLAT, filter }, RATE);
    const bright = centroid(powerSpectrum(out.subarray(0, ms(60)), RATE));
    const dull = centroid(powerSpectrum(out.subarray(ms(300), ms(400)), RATE));
    expect(bright).toBeGreaterThan(dull * 2);
  });
});

describe('createNoteKernel', () => {
  it('adds into the block it is handed and says when it has ended', () => {
    const voice = createNoteKernel({ pitch: 440, duration: 10, envelope: FLAT }, RATE);
    const block = new Float32Array(256).fill(1);
    expect(voice.render(block, 100, 200)).toBe(true);
    expect(block[50]).toBe(1);
    expect(block[250]).toBe(1);
    expect(block[150]).not.toBe(1);
    let alive = true;
    for (let i = 0; i < 10 && alive; i += 1) alive = voice.render(new Float32Array(128));
    expect(alive).toBe(false);
    const after = new Float32Array(64);
    expect(voice.render(after)).toBe(false);
    expect(after.every((v) => v === 0)).toBe(true);
  });

  it('holds a note with no duration until it is released, then runs the release', () => {
    const voice = createNoteKernel({ pitch: 440, envelope: { ...FLAT, release: 50 } }, RATE);
    expect(voice.render(new Float32Array(ms(500)))).toBe(true);
    voice.release();
    const tail = new Float32Array(ms(100));
    expect(voice.render(tail)).toBe(false);
    expect(rms(tail, 0, ms(10))).toBeGreaterThan(0.4);
    expect(rms(tail, ms(51), ms(100))).toBe(0);
  });

  it('ignores a release that comes after the gate has closed', () => {
    const voice = createNoteKernel({ pitch: 440, duration: 10, envelope: { ...FLAT, release: 100 } }, RATE);
    voice.render(new Float32Array(ms(60)));
    voice.release();
    const tail = new Float32Array(ms(60));
    expect(voice.render(tail)).toBe(false);
    // 60 ms in, 50 ms of a 100 ms release are gone: a late gate would have restarted it at full level.
    expect(rms(tail, 0, ms(5)) * Math.SQRT2).toBeLessThan(0.55);
    expect(rms(tail, ms(51), ms(60))).toBe(0);
  });

  it('retunes a voice that is already sounding', () => {
    const voice = createNoteKernel({ pitch: 300, envelope: FLAT }, RATE);
    voice.render(new Float32Array(ms(50)));
    voice.retune(2, 0);
    const out = new Float32Array(ms(200));
    voice.render(out);
    expect(crossingsHz(out, 0, out.length)).toBeCloseTo(600, -1);
  });
});

describe('renderNoise', () => {
  const white = { noise: 'white' as const, duration: 500, envelope: FLAT };

  it('sounds every color at one level', () => {
    // One whole pass of the loop: brown noise wanders, so a slice of it is not at the loop's level.
    for (const noise of ['white', 'pink', 'brown'] as const) {
      expect(rms(renderNoise({ ...white, noise, duration: 2000 }, RATE))).toBeCloseTo(0.25, 3);
    }
    expect(rms(renderNoise({ ...white, gain: 0.5, duration: 2000 }, RATE))).toBeCloseTo(0.125, 3);
  });

  it('starts where the random source says', () => {
    const a = renderNoise(white, RATE, () => 0);
    const b = renderNoise(white, RATE, () => 0.5);
    const c = renderNoise(white, RATE, () => 0);
    expect(Array.from(a.subarray(0, 32))).toEqual(Array.from(c.subarray(0, 32)));
    expect(Array.from(a.subarray(0, 32))).not.toEqual(Array.from(b.subarray(0, 32)));
  });

  it('passes less of the top through a lowpass', () => {
    const open = centroid(powerSpectrum(renderNoise(white, RATE, () => 0), RATE));
    const shut = centroid(powerSpectrum(
      renderNoise({ ...white, filter: { frequency: 500, Q: 0 } }, RATE, () => 0), RATE,
    ));
    expect(shut).toBeLessThan(open / 4);
  });

  it('shifts a brown noise up with its rate', () => {
    const at = (rate: number): number => centroid(powerSpectrum(
      renderNoise({ ...white, noise: 'brown', rate }, RATE, () => 0), RATE,
    ));
    expect(at(4)).toBeGreaterThan(at(1) * 1.5);
  });
});

describe('createNoiseKernel', () => {
  it('releases like a note', () => {
    const voice = createNoiseKernel({ noise: 'pink', envelope: { ...FLAT, release: 20 } }, RATE, () => 0);
    expect(voice.render(new Float32Array(ms(100)))).toBe(true);
    voice.release();
    expect(voice.render(new Float32Array(ms(30)))).toBe(false);
  });
});
