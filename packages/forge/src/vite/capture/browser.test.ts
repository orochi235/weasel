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
  scroll: { left: 0, top: 0 },
  lab: { globals: {}, mode: 'light' },
  colorScheme: 'light',
};

interface FakeRoute {
  request(): { url(): string; method(): string; headers(): Record<string, string> };
  continue(): Promise<void>;
  abort(): Promise<void>;
  fulfill(response: unknown): Promise<void>;
}

/** What a route handler decided for a `method` request to `url`, and what it fulfilled the request with. */
async function route(
  handler: (route: FakeRoute) => unknown,
  url: string,
  method = 'GET',
): Promise<{ decision: 'continue' | 'abort' | 'fulfill'; fulfilled?: { status: number; headers: Record<string, string> } }> {
  let decision: 'continue' | 'abort' | 'fulfill' | null = null;
  let fulfilled: { status: number; headers: Record<string, string> } | undefined;
  await handler({
    request: () => ({ url: () => url, method: () => method, headers: () => ({}) }),
    continue: async () => {
      decision = 'continue';
    },
    abort: async () => {
      decision = 'abort';
    },
    fulfill: async (response) => {
      decision = 'fulfill';
      fulfilled = response as typeof fulfilled;
    },
  });
  if (decision === null) throw new Error(`no decision for ${url}`);
  return { decision, fulfilled };
}

/** What a route handler decided for a request to `url`. */
async function decide(handler: (route: FakeRoute) => unknown, url: string): Promise<'continue' | 'abort' | 'fulfill'> {
  return (await route(handler, url)).decision;
}

/** A stand-in for Playwright recording what forge asks of it. `hold` keeps each screenshot pending until released;
 *  the first `hang` renders never settle. */
function fakePlaywright({ hold = false, hang = 0 } = {}) {
  let hangs = hang;
  const launches: { closed: boolean }[] = [];
  const pagesClosed: number[] = [];
  const contexts: number[] = [];
  const viewports: unknown[] = [];
  const media: unknown[] = [];
  const calls: string[] = [];
  const pending: (() => void)[] = [];
  const routes: ((route: FakeRoute) => unknown)[] = [];
  const sockets: ((url: URL) => boolean)[] = [];
  const contextOptions: unknown[] = [];
  const page = {
    route: async (_pattern: string, handler: (route: FakeRoute) => unknown) => {
      routes.push(handler);
    },
    routeWebSocket: async (match: (url: URL) => boolean) => {
      sockets.push(match);
    },
    setViewportSize: async (size: unknown) => {
      viewports.push(size);
    },
    emulateMedia: async (options: unknown) => {
      media.push(options);
      calls.push('emulateMedia');
    },
    goto: async () => {
      calls.push('goto');
      return null;
    },
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
          newContext: async (options: { deviceScaleFactor: number }) => {
            contexts.push(options.deviceScaleFactor);
            contextOptions.push(options);
            return { newPage: async () => page };
          },
          close: async () => {
            record.closed = true;
          },
        };
      },
    },
  };
  return {
    load: async () => playwright as never,
    launches,
    contexts,
    contextOptions,
    viewports,
    media,
    calls,
    pending,
    pagesClosed,
    routes,
    sockets,
  };
}

const launched = async (load: () => Promise<never>, fetchImpl?: typeof fetch): Promise<CaptureBrowser> => {
  const result = await launchCaptureBrowser(load, fetchImpl);
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

  it("emulates the payload's color scheme before the page loads", async () => {
    const fake = fakePlaywright();
    const browser = await launched(fake.load);
    await browser.capture('http://x/', { ...payload, colorScheme: 'dark' });
    await browser.capture('http://x/', payload);
    expect(fake.media).toEqual([{ colorScheme: 'dark' }, { colorScheme: 'light' }]);
    expect(fake.calls.slice(0, 2)).toEqual(['emulateMedia', 'goto']);
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

  it('lets the capture page reach the origins it is given as well, and still nothing else', async () => {
    const fake = fakePlaywright();
    const browser = await launched(fake.load);
    await browser.capture('http://127.0.0.1:5173/__forge/capture.html', payload, ['https://fonts.googleapis.com', 'https://fonts.gstatic.com']);
    const [handler] = fake.routes;
    expect(await decide(handler!, 'https://fonts.googleapis.com/css2?family=Oswald')).toBe('continue');
    expect(await decide(handler!, 'https://fonts.gstatic.com/s/oswald/v53/face.woff2')).toBe('continue');
    expect(await decide(handler!, 'http://127.0.0.1:5173/@id/virtual:forge/index.js')).toBe('continue');
    expect(await decide(handler!, 'https://fonts.example.com/face.woff2')).toBe('abort');
    expect(await decide(handler!, 'http://fonts.gstatic.com/s/face.woff2')).toBe('abort');
    await browser.close();
  });

  it('blocks service workers, and ignores certificate errors only for a dev server served over https', async () => {
    const fake = fakePlaywright();
    const browser = await launched(fake.load);
    await browser.capture('http://127.0.0.1:5173/__forge/capture.html', payload);
    await browser.capture('https://127.0.0.1:5173/__forge/capture.html', payload);
    expect(fake.contextOptions).toEqual([
      { deviceScaleFactor: 2, ignoreHTTPSErrors: false, serviceWorkers: 'block' },
      { deviceScaleFactor: 2, ignoreHTTPSErrors: true, serviceWorkers: 'block' },
    ]);
    await browser.close();
  });

  it("closes every WebSocket but the dev server's own", async () => {
    const fake = fakePlaywright();
    const browser = await launched(fake.load);
    await browser.capture('http://127.0.0.1:5173/__forge/capture.html', payload);
    const [denied] = fake.sockets;
    expect(denied!(new URL('ws://127.0.0.1:5173/?token=x'))).toBe(false);
    expect(denied!(new URL('ws://10.0.0.1:5173/'))).toBe(true);
    expect(denied!(new URL('ws://127.0.0.1:8080/'))).toBe(true);
    expect(denied!(new URL('wss://fonts.googleapis.com/'))).toBe(true);
    await browser.close();
  });

  it('fetches an allowlisted origin from Node under an https dev server, so its certificate is still checked', async () => {
    const fake = fakePlaywright();
    const fetched: string[] = [];
    const fetchImpl = (async (input: string) => {
      fetched.push(input);
      return new Response('font');
    }) as typeof fetch;
    const browser = await launched(fake.load, fetchImpl);
    await browser.capture('https://127.0.0.1:5173/__forge/capture.html', payload, ['https://fonts.gstatic.com']);
    const [handler] = fake.routes;
    expect(await decide(handler!, 'https://fonts.gstatic.com/s/face.woff2')).toBe('fulfill');
    expect(fetched).toEqual(['https://fonts.gstatic.com/s/face.woff2']);
    expect(await decide(handler!, 'https://127.0.0.1:5173/@vite/client')).toBe('continue');
    expect(await decide(handler!, 'https://fonts.example.com/face.woff2')).toBe('abort');
    await browser.close();
  });

  it('hands an allowlisted redirect to the page instead of following it from Node', async () => {
    const fake = fakePlaywright();
    const fetched: { url: string; redirect?: RequestRedirect }[] = [];
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      fetched.push({ url: input, redirect: init?.redirect });
      if (init?.redirect !== 'manual') return new Response('internal');
      return new Response(null, { status: 302, headers: { location: 'http://10.0.0.1/secret' } });
    }) as typeof fetch;
    const browser = await launched(fake.load, fetchImpl);
    await browser.capture('https://127.0.0.1:5173/__forge/capture.html', payload, ['https://fonts.gstatic.com']);
    const [handler] = fake.routes;
    const { decision, fulfilled } = await route(handler!, 'https://fonts.gstatic.com/s/face.woff2');
    expect(decision).toBe('fulfill');
    expect(fulfilled?.status).toBe(302);
    expect(fulfilled?.headers.location).toBe('http://10.0.0.1/secret');
    expect(fetched).toEqual([{ url: 'https://fonts.gstatic.com/s/face.woff2', redirect: 'manual' }]);
    expect(await decide(handler!, 'http://10.0.0.1/secret')).toBe('abort');
    await browser.close();
  });

  it('serves a pass-through body without the encoding headers Node already decoded it from', async () => {
    const fake = fakePlaywright();
    const fetchImpl = (async () =>
      new Response('font', {
        headers: { 'content-type': 'font/woff2', 'content-encoding': 'gzip', 'content-length': '24', 'transfer-encoding': 'chunked' },
      })) as typeof fetch;
    const browser = await launched(fake.load, fetchImpl);
    await browser.capture('https://127.0.0.1:5173/__forge/capture.html', payload, ['https://fonts.gstatic.com']);
    const [handler] = fake.routes;
    const { fulfilled } = await route(handler!, 'https://fonts.gstatic.com/s/face.woff2');
    expect(fulfilled?.headers).toEqual({ 'content-type': 'font/woff2' });
    await browser.close();
  });

  it('passes only GET and HEAD through to an allowlisted origin, and aborts anything else', async () => {
    const fake = fakePlaywright();
    const fetched: string[] = [];
    const fetchImpl = (async (_input: string, init?: RequestInit) => {
      fetched.push(init?.method ?? 'GET');
      return new Response(init?.method === 'HEAD' ? null : 'font');
    }) as typeof fetch;
    const browser = await launched(fake.load, fetchImpl);
    await browser.capture('https://127.0.0.1:5173/__forge/capture.html', payload, ['https://fonts.gstatic.com']);
    const [handler] = fake.routes;
    expect((await route(handler!, 'https://fonts.gstatic.com/s/face.woff2', 'HEAD')).decision).toBe('fulfill');
    expect((await route(handler!, 'https://fonts.gstatic.com/log', 'POST')).decision).toBe('abort');
    expect(fetched).toEqual(['HEAD']);
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
