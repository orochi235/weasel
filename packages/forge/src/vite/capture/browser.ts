import { existsSync } from 'node:fs';
import type { Browser, BrowserContext, Page, Route } from 'playwright';
import { type CapturePayload, messageOf } from './payload.ts';

/** Headless Chromium, taking screenshots of capture pages one at a time. */
export interface CaptureBrowser {
  /** A PNG of `url` rendering `payload`, loading nothing but `url`'s own origin and `allow`. Rejects with
   *  `QUEUE_FULL` while `QUEUE_CAP` captures are outstanding. */
  capture(url: string, payload: CapturePayload, allow?: readonly string[]): Promise<Buffer>;
  close(): Promise<void>;
}

export const IDLE_CLOSE_MS = 120_000;
/** How long one capture may take, page load included, before it fails and frees the queue. */
export const SHOT_DEADLINE_MS = 20_000;
export const QUEUE_CAP = 8;
export const QUEUE_FULL = 'capture queue is full';
export const INSTALL_PLAYWRIGHT = 'install playwright';
export const INSTALL_CHROMIUM = 'install Chromium for Playwright: npx playwright install chromium';

type Playwright = typeof import('playwright');
type Load = () => Promise<Playwright>;

const loadPlaywright: Load = () => import('playwright');

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

/** A request to an allowlisted origin, fetched from Node so its certificate is checked even when the page's
 *  context ignores certificate errors. Only GET and HEAD pass, and a redirect goes back to the page as-is, so its
 *  target meets the route guard on its own origin rather than being fetched from Node. */
async function passThrough(route: Route, fetchImpl: typeof fetch): Promise<void> {
  const request = route.request();
  const method = request.method();
  if (method !== 'GET' && method !== 'HEAD') return route.abort();
  try {
    const response = await fetchImpl(request.url(), { method, headers: request.headers(), redirect: 'manual' });
    await route.fulfill({
      status: response.status,
      headers: Object.fromEntries([...response.headers].filter(([name]) => !WIRE_HEADERS.has(name))),
      body: Buffer.from(await response.arrayBuffer()),
    });
  } catch {
    await route.abort();
  }
}

/**
 * Lets `page` reach nothing but the server `url` came from and the origins in `allow`, whatever a story or an
 * override asks it to load, and open no WebSocket but that server's own.
 */
async function guard(page: Page, url: string, allow: readonly string[], fetchImpl: typeof fetch): Promise<void> {
  const own = new URL(url);
  const secure = own.protocol === 'https:';
  const reach = new Set(allow);
  await page.route('**/*', (route) => {
    const origin = new URL(route.request().url()).origin;
    if (origin === own.origin) return route.continue();
    if (!reach.has(origin)) return route.abort();
    return secure ? passThrough(route, fetchImpl) : route.continue();
  });
  // Only vite's own client socket connects: closing it would have the client reload the page mid-capture.
  const ownSocket = `${secure ? 'wss:' : 'ws:'}//${own.host}`;
  await page.routeWebSocket(
    (u) => `${u.protocol}//${u.host}` !== ownSocket,
    (ws) => ws.close(),
  );
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
  let chromium: Promise<Browser> | null;
  try {
    chromium = Promise.resolve(await playwright.chromium.launch({ headless: true }));
  } catch (err) {
    return { unavailable: messageOf(err) };
  }

  const contexts = new Map<string, Promise<BrowserContext>>();
  let idle: ReturnType<typeof setTimeout> | undefined;
  let outstanding = 0;
  let tail: Promise<unknown> = Promise.resolve();

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
  const browser = (): Promise<Browser> => {
    if (!chromium) {
      const launching = playwright.chromium.launch({ headless: true });
      chromium = launching;
      launching.catch(() => {
        if (chromium === launching) chromium = null;
      });
    }
    return chromium;
  };
  /**
   * One context per device pixel ratio, since a context's scale factor is fixed when it is made, and per whether the
   * dev server is served over https: only then are certificate errors ignored, for its self-signed certificate.
   */
  const contextFor = (dpr: number, secure: boolean): Promise<BrowserContext> => {
    const key = `${dpr}:${secure}`;
    let context = contexts.get(key);
    if (!context) {
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
  const render = async (page: Page, payload: CapturePayload, url: string, allow: readonly string[]): Promise<Buffer> => {
    await guard(page, url, allow, fetchImpl);
    await page.setViewportSize({ width: Math.ceil(payload.box.width), height: Math.ceil(payload.box.height) });
    await page.emulateMedia({ colorScheme: payload.colorScheme });
    await page.goto(url);
    await page.waitForFunction(() => (window as CaptureWindow).__forgeCapture !== undefined);
    await page.evaluate((p) => (window as CaptureWindow).__forgeCapture!.render(p), payload);
    return page.locator('[data-fg-capture]').screenshot({ type: 'png' });
  };
  /** One capture, failed and its page closed once `SHOT_DEADLINE_MS` passes, so a render that never settles cannot
   *  hold the queue. */
  const shoot = async (url: string, payload: CapturePayload, allow: readonly string[]): Promise<Buffer> => {
    let page: Page | null = null;
    let late = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`capture took longer than ${SHOT_DEADLINE_MS / 1000} s`)), SHOT_DEADLINE_MS);
    });
    const work = (async () => {
      const opened = await (await contextFor(payload.dpr, url.startsWith('https:'))).newPage();
      page = opened;
      if (late) throw new Error('capture timed out');
      return render(opened, payload, url, allow);
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

  arm();
  return {
    capture(url, payload, allow = []) {
      if (outstanding >= QUEUE_CAP) return Promise.reject(new Error(QUEUE_FULL));
      outstanding += 1;
      clearTimeout(idle);
      const run = tail.then(() => shoot(url, payload, allow));
      tail = run.catch(() => {});
      return run.finally(() => {
        outstanding -= 1;
        if (outstanding === 0) arm();
      });
    },
    close: shut,
  };
}
