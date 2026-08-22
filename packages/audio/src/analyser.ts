export interface AnalyserTapOptions {
  /** Power of two, 32..32768. Default 2048. */
  fftSize?: number;
}

export interface AnalyserTap {
  /** The underlying node, exposed for disposal assertions and advanced wiring. */
  node: AnalyserNode;
  /** Frequency data, sized `node.frequencyBinCount` when no array is given. */
  frequencies(out?: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
  /** Time-domain data, sized `node.fftSize` when no array is given — twice the
   *  frequency bin count, which is the whole window rather than half of it. */
  waveform(out?: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer>;
  /** RMS amplitude over the whole time-domain window, 0..1. */
  level(): number;
  /** `n` averaged frequency bands normalized to 0..1 — the ergonomic form for
   *  driving a shader uniform, a vertex color, or a pose. `out`, when given,
   *  must be exactly `n` long. */
  bands(n: number, out?: Float32Array<ArrayBuffer>): Float32Array<ArrayBuffer>;
  /** Detach from the tapped node. Idempotent. */
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
  let attached = true;

  // `node` is public surface, so `fftSize` can change under the tap. Time-domain
  // data is sized by `fftSize`; frequency data by half of it.
  let freqScratch = new Uint8Array(0);
  let timeScratch = new Uint8Array(0);
  const freqBuf = (): Uint8Array<ArrayBuffer> => {
    if (freqScratch.length !== node.frequencyBinCount) {
      freqScratch = new Uint8Array(node.frequencyBinCount);
    }
    return freqScratch;
  };
  const timeBuf = (): Uint8Array<ArrayBuffer> => {
    if (timeScratch.length !== node.fftSize) timeScratch = new Uint8Array(node.fftSize);
    return timeScratch;
  };

  return {
    node,
    frequencies(out) {
      const target = out ?? new Uint8Array(node.frequencyBinCount);
      node.getByteFrequencyData(target);
      return target;
    },
    waveform(out) {
      const target = out ?? new Uint8Array(node.fftSize);
      node.getByteTimeDomainData(target);
      return target;
    },
    level() {
      const buf = timeBuf();
      node.getByteTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i += 1) {
        // Time-domain bytes center on 128; subtract to get a signed sample.
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      return Math.sqrt(sum / buf.length);
    },
    bands(n, out) {
      if (!Number.isInteger(n) || n < 1) {
        throw new Error('@weasel-js/audio: bands(n) requires a positive integer');
      }
      // Unlike the byte readers, a short `out` here would return fewer bands
      // than asked for with nothing to distinguish it from a correct result.
      if (out && out.length !== n) {
        throw new Error(
          `@weasel-js/audio: bands(${n}, out) requires an out array of length ${n}, got ${out.length}`,
        );
      }
      const buf = freqBuf();
      node.getByteFrequencyData(buf);
      const target = out ?? new Float32Array(n);
      const per = buf.length / n;
      for (let b = 0; b < n; b += 1) {
        const lo = Math.floor(b * per);
        const hi = Math.max(lo + 1, Math.floor((b + 1) * per));
        let sum = 0;
        for (let i = lo; i < hi; i += 1) sum += buf[i];
        target[b] = sum / (hi - lo) / 255;
      }
      return target;
    },
    // `node.disconnect()` would cut the analyser's outgoing edges, and it has
    // none: the edge that keeps it alive is the source's.
    dispose() {
      if (!attached) return;
      attached = false;
      source.disconnect(node);
    },
  };
}
