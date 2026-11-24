import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { Browser, BrowserContext, Page, Route } from 'playwright';
import { messageOf } from '../../messageOf.ts';
import type { CapturePayload } from './payload.ts';

/** Headless Chromium, taking screenshots of capture pages one at a time. */
export interface CaptureBrowser {
  /** A PNG of `url` rendering `payload`, loading nothing but `url`'s own origin and `allow`, and opening no WebSocket
   *  but to `url`'s origin and `hmr`, where vite's client connects when its HMR is served elsewhere. Rejects with
   *  `QUEUE_FULL` while `QUEUE_CAP` captures are outstanding, and with `CAPTURE_CLOSED` once closed. */
  capture(url: string, payload: CapturePayload, allow?: readonly string[], hmr?: string): Promise<Buffer>;
  close(): Promise<void>;
}

export const IDLE_CLOSE_MS = 120_000;
/** How long one capture may take, page load included, before it fails and frees the queue. */
export const SHOT_DEADLINE_MS = 20_000;
export const QUEUE_CAP = 8;
/** How many browser contexts stay open, the least recently used closed past it. */
export const CONTEXT_CAP = 4;
export const QUEUE_FULL = 'capture queue is full';
export const CAPTURE_CLOSED = 'capture browser is closed';
export const INSTALL_PLAYWRIGHT = 'install playwright';
export const INSTALL_CHROMIUM = 'install Chromium for Playwright: npx playwright install chromium';

type Playwright = typeof import('playwright');
type Load = () => Promise<Playwright>;

// Not `import()`: a dev config reloaded through vite's module runner can no longer load lazily (docs/traps/build-dev.md).
const loadPlaywright: Load = async () => createRequire(import.meta.url)('playwright') as Playwright;

/** What a capture page exposes once it has mounted. */
interface CaptureWindow {
  __forgeCapture?: { render(payload: CapturePayload): Promise<void> };
}

/** Whether a capture could start, without starting Chromium: Playwright loads and its Chromium is installed. */
export async function captureAvailability(load: Load = loadPlaywright): Promise<{ available: true } | { unavailable: string }> {
  let playwright: Playwright;
  try {
    playwright = await load();
  } catch {
    return { unavailable: INSTALL_PLAYWRIGHT };
  }
  let executable: string;
  try {
    executable = playwright.chromium.executablePath();
  } catch (err) {
    return { unavailable: messageOf(err) };
  }
  return existsSync(executable) ? { available: true } : { unavailable: INSTALL_CHROMIUM };
}

/** Headers describing the body as it came over the wire, which Node's fetch has already decoded. */
const WIRE_HEADERS = new Set(['content-encoding', 'content-length', 'transfer-encoding']);

/** How many redirects an allowlisted request may follow before it is aborted. */
const MAX_REDIRECTS = 5;

/**
 * A request to an allowlisted origin, fetched from Node so its certificate is checked even when the page's context
 * ignores certificate errors. Only GET and HEAD pass. Redirects are followed here, each hop's origin checked against
 * `reach`, because Playwright hands a redirected request to the browser without calling the route handler again.
 */
async function passThrough(route: Route, reach: (origin: string) => boolean, fetchImpl: typeof fetch): Promise<void> {
  const request = route.request();
  const method = request.method();
  if (method !== 'GET' && method !== 'HEAD') return route.abort();
  try {
    let url = request.url();
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const response = await fetchImpl(url, { method, headers: request.headers(), redirect: 'manual' });
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location !== null) {
        url = new URL(location, url).href;
        if (!reach(new URL(url).origin)) return await route.abort();
        continue;
      }
      return await route.fulfill({
        status: response.status,
        headers: Object.fromEntries([...response.headers].filter(([name]) => !WIRE_HEADERS.has(name))),
        body: Buffer.from(await response.arrayBuffer()),
      });
    }
    await route.abort();
  } catch {
    await route.abort();
  }
}

/**
 * Lets `page` reach nothing but the server `url` came from and the origins in `allow`, whatever a story or an
 * override asks it to load, and open no WebSocket but that server's own. The server's own redirects are trusted as
 * its proxy is: it can already fetch anything on the page's behalf.
 */
async function guard(page: Page, url: string, allow: readonly string[], hmr: string | undefined, fetchImpl: typeof fetch): Promise<void> {
  const own = new URL(url);
  const secure = own.protocol === 'https:';
  const reach = new Set([...allow, own.origin]);
  await page.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin;
    if (origin === own.origin) return route.continue();
    if (!reach.has(origin)) return route.abort();
    return passThrough(route, (o) => reach.has(o), fetchImpl);
  });
  // Only vite's own client socket connects: closing it would have the client reload the page mid-capture.
  const sockets = new Set([`${secure ? 'wss:' : 'ws:'}//${own.host}`, ...(hmr ? [hmr] : [])]);
  await page.routeWebSocket(
    (u) => !sockets.has(`${u.protocol}//${u.host}`),
    (ws) => ws.close(),
  );
}

/**
 * One context per device pixel ratio, since a context's scale factor is fixed when it is made, and per whether the
 * dev server is served over https: only then are certificate errors ignored, for its self-signed certificate. The
 * least recently used closes past `CONTEXT_CAP`.
 */
function contextCache(browser: () => Promise<Browser>) {
  const contexts = new Map<string, Promise<BrowserContext>>();
  const contextFor = (dpr: number, secure: boolean): Promise<BrowserContext> => {
    const key = `${dpr}:${secure}`;
    let context = contexts.get(key);
    if (context) {
      contexts.delete(key);
      contexts.set(key, context);
    } else {
      // Captures run one at a time, so no page is open in a context evicted here.
      const oldest = contexts.size >= CONTEXT_CAP ? contexts.keys().next().value : undefined;
      if (oldest !== undefined) {
        void contexts.get(oldest)!.then((c) => c.close()).catch(() => {});
        contexts.delete(oldest);
      }
      const making = browser().then((b) =>
        b.newContext({ deviceScaleFactor: dpr, ignoreHTTPSErrors: secure, serviceWorkers: 'block' }),
      );
      context = making;
      contexts.set(key, making);
      making.catch(() => {
        if (contexts.get(key) === making) contexts.delete(key);
      });
    }
    return context;
  };
  return { contextFor, clear: () => contexts.clear() };
}

/**
 * Loads Playwright and starts Chromium, or says why it cannot. Chromium closes after `IDLE_CLOSE_MS` with nothing
 * to capture and starts again for the next capture, so there is never more than one.
 */
export async function launchCaptureBrowser(
  load: Load = loadPlaywright,
  fetchImpl: typeof fetch = fetch,
): Promise<CaptureBrowser | { unavailable: string }> {
  let playwright: Playwright;
  try {
    playwright = await load();
  } catch {
    return { unavailable: INSTALL_PLAYWRIGHT };
  }
  let first: Browser;
  try {
    first = await playwright.chromium.launch({ headless: true });
  } catch (err) {
    return { unavailable: messageOf(err) };
  }

  let chromium: Promise<Browser> | null = null;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let outstanding = 0;
  let tail: Promise<unknown> = Promise.resolve();
  let closed = false;

  const shut = async () => {
    clearTimeout(idle);
    const closing = chromium;
    chromium = null;
    contexts.clear();
    await closing?.then((b) => b.close(), () => {});
  };
  const arm = () => {
    clearTimeout(idle);
    idle = setTimeout(() => void shut(), IDLE_CLOSE_MS);
    idle.unref?.();
  };
  /** Makes `launching` the browser captures use, until it fails to start or disconnects. */
  const adopt = (launching: Promise<Browser>): Promise<Browser> => {
    chromium = launching;
    const drop = () => {
      if (chromium !== launching) return;
      chromium = null;
      contexts.clear();
    };
    launching.then((b) => b.on('disconnected', drop), drop);
    return launching;
  };
  const browser = (): Promise<Browser> => {
    if (closed) return Promise.reject(new Error(CAPTURE_CLOSED));
    return chromium ?? adopt(playwright.chromium.launch({ headless: true }));
  };
  const contexts = contextCache(browser);
  const render = async (page: Page, payload: CapturePayload, url: string, allow: readonly string[], hmr: string | undefined): Promise<Buffer> => {
    await guard(page, url, allow, hmr, fetchImpl);
    await page.setViewportSize({ width: Math.ceil(payload.box.width), height: Math.ceil(payload.box.height) });
    await page.emulateMedia({ colorScheme: payload.colorScheme });
    await page.goto(url);
    await page.waitForFunction(() => (window as CaptureWindow).__forgeCapture !== undefined);
    await page.evaluate((p) => (window as CaptureWindow).__forgeCapture!.render(p), payload);
    return page.locator('[data-fg-capture]').screenshot({ type: 'png' });
  };
  /** One capture, failed and its page closed once `SHOT_DEADLINE_MS` passes, so a render that never settles cannot
   *  hold the queue. */
  const shoot = async (url: string, payload: CapturePayload, allow: readonly string[], hmr: string | undefined): Promise<Buffer> => {
    let page: Page | null = null;
    let late = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`capture took longer than ${SHOT_DEADLINE_MS / 1000} s`)), SHOT_DEADLINE_MS);
    });
    const work = (async () => {
      const opened = await (await contexts.contextFor(payload.dpr, url.startsWith('https:'))).newPage();
      page = opened;
      if (late) throw new Error('capture timed out');
      return render(opened, payload, url, allow, hmr);
    })();
    try {
      return await Promise.race([work, deadline]);
    } finally {
      late = true;
      clearTimeout(timer);
      // Closing the page rejects whatever of the capture is still waiting on it.
      await (page as Page | null)?.close().catch(() => {});
      void work.catch(() => (page as Page | null)?.close().catch(() => {}));
    }
  };

  adopt(Promise.resolve(first));
  arm();
  return {
    capture(url, payload, allow = [], hmr) {
      if (closed) return Promise.reject(new Error(CAPTURE_CLOSED));
      if (outstanding >= QUEUE_CAP) return Promise.reject(new Error(QUEUE_FULL));
      outstanding += 1;
      clearTimeout(idle);
      const run = tail.then(() => shoot(url, payload, allow, hmr));
      tail = run.catch(() => {});
      return run.finally(() => {
        outstanding -= 1;
        if (outstanding === 0 && !closed) arm();
      });
    },
    close() {
      closed = true;
      return shut();
    },
  };
}
