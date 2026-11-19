import { describe, expect, it, vi } from 'vitest';
import { renderEngineStereo } from './renderEngine';

// The render itself needs a browser; a `later.at` it cannot pause at is refused
// before any context is made, so that part runs here.
describe('renderEngineStereo', () => {
  it('refuses a later hook at or past the end of the render', async () => {
    const run = vi.fn();
    await expect(renderEngineStereo(1, () => {}, 48000, {}, { at: 1, run })).rejects.toThrow(RangeError);
    await expect(renderEngineStereo(1, () => {}, 48000, {}, { at: -0.1, run })).rejects.toThrow(RangeError);
    await expect(renderEngineStereo(1, () => {}, 48000, {}, { at: Number.NaN, run })).rejects.toThrow(RangeError);
    expect(run).not.toHaveBeenCalled();
  });

  it('refuses a later hook inside the first quantum when worklet voices hold it', async () => {
    const later = { at: 100 / 48000, run: vi.fn() };
    await expect(renderEngineStereo(1, () => {}, 48000, { synthVoices: 'worklet' }, later))
      .rejects.toThrow(/first quantum/);
  });
});
