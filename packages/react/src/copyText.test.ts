import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './copyText';

afterEach(() => vi.unstubAllGlobals());

describe('copyText', () => {
  it('answers false where the page has no clipboard', async () => {
    vi.stubGlobal('navigator', {});
    await expect(copyText('#fff')).resolves.toBe(false);
  });

  it('answers false when the browser refuses the write', async () => {
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.reject(new DOMException('no', 'NotAllowedError')) } });
    await expect(copyText('#fff')).resolves.toBe(false);
  });

  it('answers true once the clipboard takes the text', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    await expect(copyText('#fff')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('#fff');
  });
});
