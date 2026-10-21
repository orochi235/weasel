import { existsSync } from 'node:fs';
import type { Browser, BrowserContext, Page } from 'playwright';
import type { CapturePayload } from './payload.ts';

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

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

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

/**
 * Loads Playwright and starts Chromium, or says why it cannot. Chromium closes after `IDLE_CLOSE_MS` with nothing
 * to capture and starts again for the next capture, so there is never more than one.
 */
export async function launchCaptureBrowser(
  load: Load = loadPlaywright,
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

  const contexts = new Map<number, Promise<BrowserContext>>();
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
  /** One context per device pixel ratio, since a context's scale factor is fixed when it is made. */
  const contextFor = (dpr: number): Promise<BrowserContext> => {
    let context = contexts.get(dpr);
    if (!context) {
      const making = browser().then((b) => b.newContext({ deviceScaleFactor: dpr, ignoreHTTPSErrors: true }));
      context = making;
      contexts.set(dpr, making);
      making.catch(() => {
        if (contexts.get(dpr) === making) contexts.delete(dpr);
      });
    }
    return context;
  };
  const render = async (page: Page, payload: CapturePayload, url: string, allow: readonly string[]): Promise<Buffer> => {
    // The page reaches nothing but the server it came from and the origins the shell config lists, whatever a story
    // or an override asks it to load.
    const reach = new Set([new URL(url).origin, ...allow]);
    await page.route('**/*', (route) => (reach.has(new URL(route.request().url()).origin) ? route.continue() : route.abort()));
    await page.setViewportSize({ width: Math.ceil(payload.box.width), height: Math.ceil(payload.box.height) });
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
      const opened = await (await contextFor(payload.dpr)).newPage();
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
