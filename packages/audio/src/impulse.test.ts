import { describe, expect, it } from 'vitest';
import { impulseResponse } from './impulse';
import { createFakeAudioContext } from './testing/fakeAudioContext';

const ctx = createFakeAudioContext() as never as BaseAudioContext;

const rms = (data: Float32Array, from: number, to: number): number => {
  let sum = 0;
  for (let i = from; i < to; i += 1) sum += data[i] * data[i];
  return Math.sqrt(sum / (to - from));
};

describe('impulseResponse', () => {
  it('makes a decaying noise tail', () => {
    const buf = impulseResponse(ctx, 1.5);
    expect(buf.length).toBe(Math.round(1.5 * ctx.sampleRate));
    expect(buf.numberOfChannels).toBe(2);
    const n = buf.length;
    const d = buf.getChannelData(0);
    const head = rms(d, 0, Math.floor(n / 10));
    const tail = rms(d, n - Math.floor(n / 10), n);
    expect(20 * Math.log10(head / tail)).toBeGreaterThanOrEqual(50);
  });

  it('differs between channels and is deterministic per seed', () => {
    const a = impulseResponse(ctx, 0.1);
    expect(a.getChannelData(0)).not.toEqual(a.getChannelData(1));
    const same = impulseResponse(ctx, 0.1);
    expect(same.getChannelData(0)).toEqual(a.getChannelData(0));
    expect(same.getChannelData(1)).toEqual(a.getChannelData(1));
    const other = impulseResponse(ctx, 0.1, { seed: 2 });
    expect(other.getChannelData(0)).not.toEqual(a.getChannelData(0));
  });

  it('honors channels and decayDb', () => {
    const buf = impulseResponse(ctx, 0.5, { channels: 1, decayDb: 20 });
    expect(buf.numberOfChannels).toBe(1);
    const d = buf.getChannelData(0);
    const n = d.length;
    const drop = 20 * Math.log10(rms(d, 0, n / 10) / rms(d, n - n / 10, n));
    expect(drop).toBeLessThan(30);
  });

  it('throws on a non-positive duration', () => {
    expect(() => impulseResponse(ctx, 0)).toThrow(RangeError);
    expect(() => impulseResponse(ctx, -1)).toThrow(/@weasel-js\/audio: /);
  });
});
