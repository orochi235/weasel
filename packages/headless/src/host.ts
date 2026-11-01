import { readFileSync } from 'node:fs';
import type { Browser, BrowserContext, LaunchOptions, Page } from 'playwright-core';
import { PAGE_GLOBAL, sceneToWire, type PageApi, type PageRequest, type PageResult, type SerializableRenderArgs } from './protocol';

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

/** Straight RGBA, top-down, 4 bytes a pixel: core's `RasterImage`. */
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
  try {
    const context = await browser.newContext({ deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.addScriptTag({ content: script });
    const ready = await page.evaluate((key) => key in globalThis, PAGE_GLOBAL);
    if (!ready) throw new Error('node raster host: the page script ran but set no render entry');
    return { browser, context, page };
  } catch (err) {
    if (!options.browser) await browser.close();
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
    opening ??= open(options).catch((err: unknown) => {
      opening = null;
      throw err;
    });
    const { page } = await opening;
    const { scene, screen, ...rest } = args;
    const req: PageRequest = {
      ...rest, scene: sceneToWire(scene), format, ...(screen ? { screen: Array.from(screen) } : {}),
    };
    return page.evaluate(
      ([key, r]) => ((globalThis as unknown as Record<string, PageApi>)[key]!).render(r),
      [PAGE_GLOBAL, req] as const,
    );
  }

  async function dispose(): Promise<void> {
    if (disposed) return;
    disposed = true;
    const pending = opening;
    opening = null;
    if (!pending) return;
    const opened = await pending.catch(() => null);
    if (!opened) return;
    if (options.browser) await opened.context.close();
    else await opened.browser.close();
  }

  return {
    async render(args) {
      const { width, height, base64 } = await call(args, 'rgba');
      const bytes = Buffer.from(base64, 'base64');
      return { width, height, data: new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.byteLength) };
    },
    async renderPng(args) {
      const { width, height, base64 } = await call(args, 'png');
      return { width, height, png: new Uint8Array(Buffer.from(base64, 'base64')) };
    },
    dispose,
    [Symbol.asyncDispose]: dispose,
  };
}
