import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TextOutlinesDemo', () => {
  it('loads the face again on the next mount after a load fails', async () => {
    const loads: string[] = [];
    let fail = true;
    vi.stubGlobal('FontFace', class {
      constructor(readonly family: string) {}
      load() {
        loads.push(this.family);
        return fail ? Promise.reject(new Error('offline')) : Promise.resolve(this);
      }
    });
    const add = vi.fn();
    Object.defineProperty(document, 'fonts', { configurable: true, value: { add } });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { TextOutlinesDemo } = await import('../TextOutlinesDemo');

    render(<TextOutlinesDemo />);
    await vi.waitFor(() => { expect(warn).toHaveBeenCalled(); });
    cleanup();
    fail = false;
    render(<TextOutlinesDemo />);
    await vi.waitFor(() => { expect(add).toHaveBeenCalledTimes(1); });
    expect(loads).toHaveLength(2);
  });
});
