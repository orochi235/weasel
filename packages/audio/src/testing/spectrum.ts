/** Signal measurements for tests that render real audio: levels, envelopes and
 *  averaged power spectra. Plain arrays in, plain numbers out. */

/** In-place radix-2 FFT. `re.length` must be a power of two. */
function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k += 1) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const a = i + k;
        const b = a + len / 2;
        const xr = re[b] * wr - im[b] * wi;
        const xi = re[b] * wi + im[b] * wr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
      }
    }
  }
}

export interface Spectrum {
  /** Mean power per bin, 0 Hz up to (not including) Nyquist. */
  power: Float64Array;
  /** Hz per bin. */
  binHz: number;
}

/** Welch's method: Hann-windowed frames of `size`, half overlapped, averaged. */
export function powerSpectrum(x: ArrayLike<number>, rate: number, size = 2048): Spectrum {
  const power = new Float64Array(size / 2);
  const re = new Float64Array(size);
  const im = new Float64Array(size);
  let frames = 0;
  for (let start = 0; start + size <= x.length; start += size / 2) {
    for (let i = 0; i < size; i += 1) {
      re[i] = x[start + i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k < size / 2; k += 1) power[k] += re[k] * re[k] + im[k] * im[k];
    frames += 1;
  }
  if (frames > 0) for (let k = 0; k < power.length; k += 1) power[k] /= frames;
  return { power, binHz: rate / size };
}

/** Total power between `lo` and `hi` Hz. */
export function bandPower(s: Spectrum, lo: number, hi: number): number {
  let sum = 0;
  const from = Math.max(0, Math.ceil(lo / s.binHz));
  const to = Math.min(s.power.length - 1, Math.floor(hi / s.binHz));
  for (let k = from; k <= to; k += 1) sum += s.power[k];
  return sum;
}

/** Power in the octave centered on `hz`, divided by the octave's width, in dB —
 *  so the figure for white noise is flat across octaves. */
export function octaveDensityDb(s: Spectrum, hz: number): number {
  const lo = hz / Math.SQRT2;
  const hi = hz * Math.SQRT2;
  return 10 * Math.log10(bandPower(s, lo, hi) / (hi - lo));
}

/** The power-weighted mean frequency, in Hz. */
export function centroid(s: Spectrum): number {
  let num = 0;
  let den = 0;
  for (let k = 1; k < s.power.length; k += 1) {
    num += k * s.binHz * s.power[k];
    den += s.power[k];
  }
  return den > 0 ? num / den : 0;
}

/** Frequencies of the `count` strongest local maxima, strongest first. */
export function peaks(s: Spectrum, count: number): number[] {
  const found: { hz: number; p: number }[] = [];
  for (let k = 1; k < s.power.length - 1; k += 1) {
    if (s.power[k] > s.power[k - 1] && s.power[k] >= s.power[k + 1]) {
      found.push({ hz: k * s.binHz, p: s.power[k] });
    }
  }
  return found.sort((a, b) => b.p - a.p).slice(0, count).map((f) => f.hz);
}

export function rms(x: ArrayLike<number>, from = 0, to = x.length): number {
  let sq = 0;
  for (let i = from; i < to; i += 1) sq += x[i] * x[i];
  return to > from ? Math.sqrt(sq / (to - from)) : 0;
}

/** RMS over consecutive windows of `window` samples. */
export function rmsEnvelope(x: ArrayLike<number>, window: number): number[] {
  const out: number[] = [];
  for (let i = 0; i + window <= x.length; i += window) out.push(rms(x, i, i + window));
  return out;
}
