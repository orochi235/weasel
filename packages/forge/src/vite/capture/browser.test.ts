// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  type CaptureBrowser,
  captureAvailability,
  IDLE_CLOSE_MS,
  INSTALL_CHROMIUM,
  INSTALL_PLAYWRIGHT,
  launchCaptureBrowser,
  QUEUE_CAP,
  QUEUE_FULL,
  SHOT_DEADLINE_MS,
} from './browser';
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
  lab: { globals: {}, mode: 'light' },
};

interface FakeRoute {
  request(): { url(): string };
  continue(): Promise<void>;
  abort(): Promise<void>;
}

/** What a route handler decided for a request to `url`. */
async function decide(handler: (route: FakeRoute) => unknown, url: string): Promise<'continue' | 'abort'> {
  let decision: 'continue' | 'abort' | null = null;
  await handler({
    request: () => ({ url: () => url }),
    continue: async () => {
      decision = 'continue';
    },
    abort: async () => {
      decision = 'abort';
    },
  });
  if (decision === null) throw new Error(`no decision for ${url}`);
  return decision;
}

/** A stand-in for Playwright recording what forge asks of it. `hold` keeps each screenshot pending until released;
 *  the first `hang` renders never settle. */
function fakePlaywright({ hold = false, hang = 0 } = {}) {
  let hangs = hang;
  const launches: { closed: boolean }[] = [];
  const pagesClosed: number[] = [];
  const contexts: number[] = [];
  const viewports: unknown[] = [];
  const pending: (() => void)[] = [];
  const routes: ((route: FakeRoute) => unknown)[] = [];
  const page = {
    route: async (_pattern: string, handler: (route: FakeRoute) => unknown) => {
      routes.push(handler);
    },
    setViewportSize: async (size: unknown) => {
      viewports.push(size);
    },
    goto: async () => null,
    waitForFunction: async () => null,
    evaluate: () => (hangs-- > 0 ? new Promise(() => {}) : Promise.resolve(undefined)),
    locator: () => ({
      screenshot: () =>
        hold
          ? new Promise<Buffer>((resolve) => pending.push(() => resolve(Buffer.from('png'))))
          : Promise.resolve(Buffer.from('png')),
    }),
    close: async () => {
      pagesClosed.push(1);
    },
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
  return { load: async () => playwright as never, launches, contexts, viewports, pending, pagesClosed, routes };
}

const launched = async (load: () => Promise<never>): Promise<CaptureBrowser> => {
  const result = await launchCaptureBrowser(load);
  if ('unavailable' in result) throw new Error(result.unavailable);
  return result;
};

afterEach(() => vi.useRealTimers());

describe('captureAvailability', () => {
  const withExecutable = (path: string) => async () => ({ chromium: { executablePath: () => path } }) as never;

  it('says Pixels is available when Playwright loads and its Chromium is installed, launching nothing', async () => {
    expect(await captureAvailability(withExecutable(process.execPath))).toEqual({ available: true });
  });

  it('asks for Playwright when it cannot be loaded', async () => {
    expect(await captureAvailability(() => Promise.reject(new Error('Cannot find package')))).toEqual({
      unavailable: INSTALL_PLAYWRIGHT,
    });
  });

  it('asks for Chromium when Playwright has none installed', async () => {
    expect(await captureAvailability(withExecutable('/no/such/chromium'))).toEqual({ unavailable: INSTALL_CHROMIUM });
  });
});

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

  it('fails a capture that has not finished in 20 s, closes its page, and takes the next', async () => {
    vi.useFakeTimers();
    const fake = fakePlaywright({ hang: 1 });
    const browser = await launched(fake.load);
    const stuck = browser.capture('http://x/', payload);
    const failed = expect(stuck).rejects.toThrow('capture took longer than 20 s');
    await vi.advanceTimersByTimeAsync(SHOT_DEADLINE_MS);
    await failed;
    expect(fake.pagesClosed.length).toBeGreaterThan(0);

    await expect(browser.capture('http://x/', payload)).resolves.toEqual(Buffer.from('png'));
    await browser.close();
  });

  it('lets the capture page reach only the dev server it came from', async () => {
    const fake = fakePlaywright();
    const browser = await launched(fake.load);
    await browser.capture('http://127.0.0.1:5173/__forge/capture.html', payload);
    const [handler] = fake.routes;
    expect(handler).toBeDefined();
    expect(await decide(handler!, 'http://127.0.0.1:5173/@id/virtual:forge/index.js')).toBe('continue');
    expect(await decide(handler!, 'http://10.0.0.1/any.png')).toBe('abort');
    expect(await decide(handler!, 'http://127.0.0.1:8080/other')).toBe('abort');
    expect(await decide(handler!, 'https://fonts.example.com/face.woff2')).toBe('abort');
    await browser.close();
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
