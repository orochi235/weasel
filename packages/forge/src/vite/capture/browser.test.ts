// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type CaptureBrowser, IDLE_CLOSE_MS, INSTALL_PLAYWRIGHT, launchCaptureBrowser, QUEUE_CAP, QUEUE_FULL } from './browser';
import type { CapturePayload } from './payload';

const payload: CapturePayload = {
  story: 'ui-a--only',
  isolate: false,
  config: {},
  state: null,
  globals: {},
  overrides: {},
  playhead: null,
  box: { width: 100.5, height: 50 },
  layout: 'padded',
  dpr: 2,
};

/** A stand-in for Playwright recording what forge asks of it. `hold` keeps each screenshot pending until released. */
function fakePlaywright({ hold = false } = {}) {
  const launches: { closed: boolean }[] = [];
  const contexts: number[] = [];
  const viewports: unknown[] = [];
  const pending: (() => void)[] = [];
  const page = {
    setViewportSize: async (size: unknown) => {
      viewports.push(size);
    },
    goto: async () => null,
    waitForFunction: async () => null,
    evaluate: async () => undefined,
    locator: () => ({
      screenshot: () =>
        hold
          ? new Promise<Buffer>((resolve) => pending.push(() => resolve(Buffer.from('png'))))
          : Promise.resolve(Buffer.from('png')),
    }),
    close: async () => {},
  };
  const playwright = {
    chromium: {
      launch: async () => {
        const record = { closed: false };
        launches.push(record);
        return {
          newContext: async ({ deviceScaleFactor }: { deviceScaleFactor: number }) => {
            contexts.push(deviceScaleFactor);
            return { newPage: async () => page };
          },
          close: async () => {
            record.closed = true;
          },
        };
      },
    },
  };
  return { load: async () => playwright as never, launches, contexts, viewports, pending };
}

const launched = async (load: () => Promise<never>): Promise<CaptureBrowser> => {
  const result = await launchCaptureBrowser(load);
  if ('unavailable' in result) throw new Error(result.unavailable);
  return result;
};

afterEach(() => vi.useRealTimers());

describe('launchCaptureBrowser', () => {
  it('reports "install playwright" when Playwright cannot be loaded', async () => {
    expect(await launchCaptureBrowser(() => Promise.reject(new Error('Cannot find package')))).toEqual({
      unavailable: INSTALL_PLAYWRIGHT,
    });
  });

  it('reports a Chromium launch failure by its message', async () => {
    const load = async () => ({ chromium: { launch: () => Promise.reject(new Error('Executable doesn’t exist')) } }) as never;
    expect(await launchCaptureBrowser(load)).toEqual({ unavailable: 'Executable doesn’t exist' });
  });

  it('keeps one context per DPR, and sizes the page to the box', async () => {
    const fake = fakePlaywright();
    const browser = await launched(fake.load);
    await browser.capture('http://x/', payload);
    await browser.capture('http://x/', payload);
    await browser.capture('http://x/', { ...payload, dpr: 1 });
    expect(fake.contexts).toEqual([2, 1]);
    expect(fake.viewports[0]).toEqual({ width: 101, height: 50 });
    expect(fake.launches).toHaveLength(1);
    await browser.close();
  });

  it('closes Chromium after 120 s idle, and starts one again for the next capture', async () => {
    vi.useFakeTimers();
    const fake = fakePlaywright();
    const browser = await launched(fake.load);
    await browser.capture('http://x/', payload);
    await vi.advanceTimersByTimeAsync(IDLE_CLOSE_MS - 1);
    expect(fake.launches[0]!.closed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(fake.launches[0]!.closed).toBe(true);

    await browser.capture('http://x/', payload);
    expect(fake.launches).toHaveLength(2);
    expect(fake.launches[1]!.closed).toBe(false);
    await browser.close();
    expect(fake.launches[1]!.closed).toBe(true);
  });

  it('refuses a capture past eight outstanding, and takes captures one at a time', async () => {
    const fake = fakePlaywright({ hold: true });
    const browser = await launched(fake.load);
    const queued = Array.from({ length: QUEUE_CAP }, () => browser.capture('http://x/', payload));
    await expect(browser.capture('http://x/', payload)).rejects.toThrow(QUEUE_FULL);
    await vi.waitFor(() => expect(fake.pending).toHaveLength(1));
    // Only one screenshot is in flight; each next one starts once the one before it is done.
    for (let i = 0; i < QUEUE_CAP; i += 1) {
      await vi.waitFor(() => expect(fake.pending).toHaveLength(i + 1));
      fake.pending[i]!();
    }
    await expect(Promise.all(queued)).resolves.toHaveLength(QUEUE_CAP);
    const next = browser.capture('http://x/', payload);
    await vi.waitFor(() => expect(fake.pending).toHaveLength(QUEUE_CAP + 1));
    fake.pending[QUEUE_CAP]!();
    await expect(next).resolves.toEqual(expect.any(Buffer));
    await browser.close();
  });
});
