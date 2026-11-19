import { describe, expect, it } from 'vitest';
import { renderEngineStereo } from './renderEngine';
import { rms } from './spectrum';

const RATE = 48000;
const silent = (): void => {};

describe('renderEngineStereo', () => {
  it('refuses a later.at outside the render instead of never running it', async () => {
    await expect(renderEngineStereo(0.1, silent, RATE, {}, { at: 0.2, run: silent }))
      .rejects.toThrow(RangeError);
    await expect(renderEngineStereo(0.1, silent, RATE, {}, { at: -0.01, run: silent }))
      .rejects.toThrow(RangeError);
  });

  it('runs a later.at inside the worklet hold’s quantum during that hold', async () => {
    let ran = false;
    const [left] = await renderEngineStereo(0.1, silent, RATE, { synthVoices: 'worklet' }, {
      at: 0,
      run: (e) => { ran = true; e.playNote({ pitch: 440, when: e.now() }); },
    });
    expect(ran).toBe(true);
    expect(rms(left)).toBeGreaterThan(0.01);
  });
});
