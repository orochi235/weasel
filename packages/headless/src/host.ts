import { readFileSync } from 'node:fs';
import type { Browser, BrowserContext, LaunchOptions, Page } from 'playwright-core';
import { PAGE_GLOBAL, readPageRequest, sceneToWire, type PageApi, type PageRequest, type PageResult, type SerializableRenderArgs } from './protocol';

/** Where a {@link NodeRasterHost} renders. */
export interface NodeRasterHostOptions {
  /** A browser to render in, which the host leaves open on `dispose`. Default: the host launches
   *  Playwright's Chromium on its first render and closes it on `dispose`. */
  browser?: Browser;
  /** Launch options for the Chromium the host starts. Ignored with `browser`. */
  launch?: LaunchOptions;
  /** The page script's source: one classic script that imports `@weasel-js/headless/page`.
   *  Default: that module bundled alone (`dist/page.global.js`). Bundle your own to register
   *  fonts, paint kinds or node shapes before the first render. */
  pageScript?: string;
}

/** Straight RGBA, top-down, 4 bytes a pixel: core's `RasterImage`. Declared here, not imported, because
 *  core's barrel brings React's and the DOM's types into a Node consumer's program (`check:needs`). */
export interface RasterImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

/** One render: `renderSceneToPixels`'s arguments, the scene as JSON and no function-valued fields. */
export interface NodeRenderArgs extends SerializableRenderArgs {
  /** A live `Scene`, or its `toJSON()` snapshot, raw or saved through `tagTypedArrays`. A scene
   *  whose nodes name registry functions (`clipFromPose` and the like) cannot be read back in the
   *  page. */
  scene: object;
  /** Screen space → output pixels, as `renderSceneToPixels`'s `screen` (nine numbers, column-major). */
  screen?: ArrayLike<number>;
}

/** A Chromium page holding one raster session, kept across renders. */
export interface NodeRasterHost {
  /** Render to straight RGBA, top-down, as `renderSceneToPixels` returns it. Rejects once disposed. */
  render(args: NodeRenderArgs): Promise<RasterImage>;
  /** Render and encode as PNG. The page encodes through a 2D canvas, which stores premultiplied
   *  color, so a translucent pixel's color can move by a step; `render` returns the exact bytes. */
  renderPng(args: NodeRenderArgs): Promise<{ width: number; height: number; png: Uint8Array }>;
  /** Close the page, and the browser when the host launched it. Idempotent. */
  dispose(): Promise<void>;
  [Symbol.asyncDispose](): Promise<void>;
}

interface Open {
  browser: Browser;
  context: BrowserContext;
  page: Page;
  /** The page's renderer crashed: it stays open, and every call on it throws. */
  crashed: boolean;
}

function defaultPageScript(): string {
  const url = new URL('./page.global.js', import.meta.url);
  try {
    return readFileSync(url, 'utf8');
  } catch (err) {
    throw new Error(`node raster host: no page script at ${url.pathname} — pass \`pageScript\``, { cause: err });
  }
}

async function open(options: NodeRasterHostOptions): Promise<Open> {
  const script = options.pageScript ?? defaultPageScript();
  const browser = options.browser
    ?? await (await import('playwright-core')).chromium.launch({ headless: true, ...options.launch });
  let context: BrowserContext | null = null;
  try {
    context = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await context.newPage();
    const opened: Open = { browser, context, page, crashed: false };
    page.on('crash', () => { opened.crashed = true; });
    await page.addScriptTag({ content: script });
    const ready = await page.evaluate((key) => key in globalThis, PAGE_GLOBAL);
    if (!ready) throw new Error('node raster host: the page script ran but set no render entry');
    return opened;
  } catch (err) {
    if (!options.browser) await browser.close();
    else await context?.close();
    throw err;
  }
}

/**
 * Open a host that renders scenes to pixels from Node, through `renderSceneToPixels` in a headless
 * Chromium page. Nothing launches until the first render; every render after it reuses the page,
 * its WebGL2 context and its GPU caches.
 */
export function createNodeRasterHost(options: NodeRasterHostOptions = {}): NodeRasterHost {
  let opening: Promise<Open> | null = null;
  let disposed = false;

  async function call(args: NodeRenderArgs, format: PageRequest['format']): Promise<PageResult> {
    if (disposed) throw new Error('node raster host: render on a disposed host');
    const { scene, screen, ...rest } = args;
    // Refused here, a bad request rejects before any browser starts.
    const req = readPageRequest({
      ...rest, scene: sceneToWire(scene), format, ...(screen ? { screen: Array.from(screen) } : {}),
    });
    opening ??= open(options).catch((err: unknown) => {
      opening = null;
      throw err;
    });
    const pending = opening;
    const opened = await pending;
    // Disposed while the page opened: the dispose closes it, and this render would fail as a closed page.
    if (disposed) throw new Error('node raster host: render on a disposed host');
    try {
      return await opened.page.evaluate(
        ([key, r]) => ((globalThis as unknown as Record<string, PageApi>)[key]!).render(r),
        [PAGE_GLOBAL, req] as const,
      );
    } catch (err) {
      // A page crashed, or a page or browser gone for good: the next render opens another rather than failing on it too.
      if (opening === pending && (opened.crashed || opened.page.isClosed() || !opened.browser.isConnected())) {
        opening = null;
        void close(opened).catch(() => undefined);
      }
      throw err;
    }
  }

  /** Close what `open` opened: the context in a caller's browser, or the browser the host launched. */
  async function close(opened: Open): Promise<void> {
    if (options.browser) await opened.context.close();
    else await opened.browser.close();
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    const pending = opening;
    opening = null;
    if (!pending) return;
    const opened = await pending.catch(() => null);
    if (opened) await close(opened);
  }

  return {
    async render(args) {
      const { width, height, base64 } = await call(args, 'rgba');
      // A small decode lands in Node's shared Buffer pool, so a view over it would hand the caller
      // other buffers' memory as `data.buffer`.
      const bytes = Buffer.from(base64, 'base64');
      return { width, height, data: new Uint8ClampedArray(bytes) };
    },
    async renderPng(args) {
      const { width, height, base64 } = await call(args, 'png');
      return { width, height, png: new Uint8Array(Buffer.from(base64, 'base64')) };
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}
