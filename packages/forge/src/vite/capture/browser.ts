import type { Browser, BrowserContext } from 'playwright';
import type { CapturePayload } from './payload.ts';

/** Headless Chromium, taking screenshots of capture pages one at a time. */
export interface CaptureBrowser {
  /** A PNG of `url` rendering `payload`. Rejects with `QUEUE_FULL` while `QUEUE_CAP` captures are outstanding. */
  capture(url: string, payload: CapturePayload): Promise<Buffer>;
  close(): Promise<void>;
}

export const IDLE_CLOSE_MS = 120_000;
export const QUEUE_CAP = 8;
export const QUEUE_FULL = 'capture queue is full';
export const INSTALL_PLAYWRIGHT = 'install playwright';

type Playwright = typeof import('playwright');

/** What a capture page exposes once it has mounted. */
interface CaptureWindow {
  __forgeCapture?: { render(payload: CapturePayload): Promise<void> };
}

const messageOf = (err: unknown) => (err instanceof Error ? err.message : String(err));

/**
 * Loads Playwright and starts Chromium, or says why it cannot. Chromium closes after `IDLE_CLOSE_MS` with nothing
 * to capture and starts again for the next capture, so there is never more than one.
 */
export async function launchCaptureBrowser(
  load: () => Promise<Playwright> = () => import('playwright'),
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
      const making = browser().then((b) => b.newContext({ deviceScaleFactor: dpr }));
      context = making;
      contexts.set(dpr, making);
      making.catch(() => {
        if (contexts.get(dpr) === making) contexts.delete(dpr);
      });
    }
    return context;
  };
  const shoot = async (url: string, payload: CapturePayload): Promise<Buffer> => {
    const page = await (await contextFor(payload.dpr)).newPage();
    try {
      await page.setViewportSize({ width: Math.ceil(payload.box.width), height: Math.ceil(payload.box.height) });
      await page.goto(url);
      await page.waitForFunction(() => (window as CaptureWindow).__forgeCapture !== undefined);
      await page.evaluate((p) => (window as CaptureWindow).__forgeCapture!.render(p), payload);
      return await page.locator('[data-fg-capture]').screenshot({ type: 'png' });
    } finally {
      await page.close();
    }
  };

  arm();
  return {
    capture(url, payload) {
      if (outstanding >= QUEUE_CAP) return Promise.reject(new Error(QUEUE_FULL));
      outstanding += 1;
      clearTimeout(idle);
      const run = tail.then(() => shoot(url, payload));
      tail = run.catch(() => {});
      return run.finally(() => {
        outstanding -= 1;
        if (outstanding === 0) arm();
      });
    },
    close: shut,
  };
}
