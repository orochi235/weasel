import { describe, expect, it } from 'vitest';
import { writeParam } from './param';
import { createChainPool } from './voiceChains';

// As the specification has it: `setValueAtTime` moves `.value` only at the next
// render, while the `.value` setter moves it at once.
function laggingParam(initial: number) {
  const ramps: { from: number; to: number }[] = [];
  let current = initial;
  let anchor = initial;
  const p = {
    get value() { return current; },
    set value(v: number) { current = v; },
    cancelScheduledValues: () => p,
    setValueAtTime(v: number) { anchor = v; return p; },
    linearRampToValueAtTime(v: number) { ramps.push({ from: anchor, to: v }); return p; },
    ramps,
  };
  return p;
}

const ctx = { currentTime: 0 } as unknown as BaseAudioContext;

describe('writeParam', () => {
  it('ramps from a step written earlier in the same task', () => {
    const p = laggingParam(1);
    writeParam(ctx, p as never, 0);
    writeParam(ctx, p as never, 1, 3000);
    expect(p.ramps).toEqual([{ from: 0, to: 1 }]);
  });

  it('starts a fade on a new voice from the gain it was taken at', () => {
    const gains: ReturnType<typeof laggingParam>[] = [];
    const fake = {
      currentTime: 0,
      createGain: () => {
        const gain = laggingParam(1);
        gains.push(gain);
        return { gain, connect() {}, disconnect() {} };
      },
      createStereoPanner: () => ({ pan: laggingParam(0), connect() {}, disconnect() {} }),
    };
    const out = createChainPool(fake as never, 4).take({} as never, 0, 0);
    out.level(1, 2000);
    expect(gains[0].ramps).toEqual([{ from: 0, to: 1 }]);
  });
});
