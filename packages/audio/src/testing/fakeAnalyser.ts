import { node, type FakeNode } from './fakeNode';

export interface FakeAnalyser extends FakeNode {
  fftSize: number;
  readonly frequencyBinCount: number;
  getByteFrequencyData(out: Uint8Array): void;
  getByteTimeDomainData(out: Uint8Array): void;
}

/** Analyser output: a constant for every bin, or a function of bin index and
 *  the analyser's bin count (`frequencyBinCount` for frequency data, `fftSize`
 *  for time-domain data) so index and window-size math is observable. */
export type FakeAnalyserBytes = number | ((index: number, length: number) => number);

// Writes at most `bins` elements, as the specification requires: an oversized
// array keeps whatever was in the tail, it does not get more data. A bin's value
// depends on the analyser, never on the length of the array it is read into.
const fill = (out: Uint8Array, bins: number, spec: FakeAnalyserBytes): void => {
  const n = Math.min(out.length, bins);
  for (let i = 0; i < n; i += 1) {
    out[i] = typeof spec === 'function' ? spec(i, bins) : spec;
  }
};

/** An analyser reporting whatever `bytes()` holds at the time of each read. */
export function createFakeAnalyser(bytes: () => FakeAnalyserBytes): FakeAnalyser {
  const a = node('analyser', {
    fftSize: 2048,
    getByteFrequencyData(out: Uint8Array) { fill(out, a.fftSize / 2, bytes()); },
    getByteTimeDomainData(out: Uint8Array) { fill(out, a.fftSize, bytes()); },
  });
  Object.defineProperty(a, 'frequencyBinCount', {
    get: () => a.fftSize / 2,
    enumerable: true,
  });
  return a as unknown as FakeAnalyser;
}
