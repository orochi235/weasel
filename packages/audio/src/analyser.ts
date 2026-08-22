export interface AnalyserTapOptions {
  /** Power of two, 32..32768. Default 2048. */
  fftSize?: number;
}

export interface AnalyserTap {
  /** The underlying node, exposed for disposal assertions and advanced wiring. */
  node: AnalyserNode;
  frequencies(out?: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
  waveform(out?: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
  /** RMS amplitude, 0..1. */
  level(): number;
  /** `n` averaged frequency bands normalized to 0..1 — the ergonomic form for
   *  driving a shader uniform, a vertex color, or a pose. */
  bands(n: number): Float32Array;
  dispose(): void;
}

export function createAnalyserTap(
  ctx: AudioContext,
  source: AudioNode,
  opts: AnalyserTapOptions = {},
): AnalyserTap {
  const node = ctx.createAnalyser();
  node.fftSize = opts.fftSize ?? 2048;
  source.connect(node);

  const freqScratch = new Uint8Array(node.frequencyBinCount);
  const timeScratch = new Uint8Array(node.frequencyBinCount);

  return {
    node,
    frequencies(out) {
      const target = out ?? new Uint8Array(node.frequencyBinCount);
      node.getByteFrequencyData(target);
      return target;
    },
    waveform(out) {
      const target = out ?? new Uint8Array(node.frequencyBinCount);
      node.getByteTimeDomainData(target);
      return target;
    },
    level() {
      node.getByteTimeDomainData(timeScratch);
      let sum = 0;
      for (let i = 0; i < timeScratch.length; i += 1) {
        // Time-domain bytes center on 128; subtract to get a signed sample.
        const v = (timeScratch[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / timeScratch.length);
    },
    bands(n) {
      if (!Number.isInteger(n) || n < 1) {
        throw new Error('@weasel-js/audio: bands(n) requires a positive integer');
      }
      node.getByteFrequencyData(freqScratch);
      const out = new Float32Array(n);
      const per = freqScratch.length / n;
      for (let b = 0; b < n; b += 1) {
        const lo = Math.floor(b * per);
        const hi = Math.max(lo + 1, Math.floor((b + 1) * per));
        let sum = 0;
        for (let i = lo; i < hi; i += 1) sum += freqScratch[i];
        out[b] = sum / (hi - lo) / 255;
      }
      return out;
    },
    dispose() { node.disconnect(); },
  };
}
