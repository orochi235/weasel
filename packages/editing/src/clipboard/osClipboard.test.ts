import { afterEach, describe, expect, it } from 'vitest';
import { writeOsClipboard } from './osClipboard';

describe('writeOsClipboard', () => {
  const unhandled: unknown[] = [];
  const onUnhandled = (reason: unknown) => { unhandled.push(reason); };
  afterEach(() => {
    process.off('unhandledRejection', onUnhandled);
    unhandled.length = 0;
  });

  it('handles a promised flavor that rejects on a page with no clipboard API', async () => {
    expect((globalThis as { ClipboardItem?: unknown }).ClipboardItem).toBeUndefined();
    process.on('unhandledRejection', onUnhandled);
    await writeOsClipboard({ 'image/svg+xml': Promise.reject(new Error('warm failed')) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(unhandled).toEqual([]);
  });
});
