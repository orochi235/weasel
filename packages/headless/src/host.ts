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
  /** The page script's source: one classic script that calls `serveHeadlessPage` from
   *  `@weasel-js/headless/page`, at once or within 30 seconds, as after its fonts load. Default:
   *  `dist/page.global.js`, which calls it with no options. Bundle your own to register fonts, paint kinds or node shapes, and to give the page your
   *  scenes' registry, composition, layout frame and quantize rule. */
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
  /** A live `Scene`, or its `toJSON()` snapshot, raw or encoded (`encodeSnapshot`). The page reads
   *  it back with the scene options its page script served; a scene naming a registry function the
   *  page lacks is refused. */
  scene: object;
  /** Screen space → output pixels, as `renderSceneToPixels`'s `screen` (nine numbers, column-major). */
  screen?: ArrayLike<number>;
}

/** A Chromium page holding one raster session, kept across renders. */
export interface NodeRasterHost {
  /** Render to straight RGBA, top-down, as `renderSceneToPixels` returns it. Rejects once disposed, and
   *  for a render or PNG of more than `MAX_RESULT_BYTES`: render a larger one in tiles. */
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

/** How long a page script may take to call `serveHeadlessPage`, as one that waits for its fonts to load. */
const READY_MS = 30_000;

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
    let threw: (err: Error) => void = () => {};
    const thrown = new Promise<Error>((resolve) => { threw = resolve; });
    page.on('pageerror', (err) => threw(err));
    await page.addScriptTag({ content: script });
    const ready = page.evaluate(([key, ms]) => new Promise<boolean>((resolve) => {
      const until = Date.now() + ms;
      const poll = (): void => {
        if (Object.hasOwn(globalThis, key)) resolve(true);
        else if (Date.now() >= until) resolve(false);
        else setTimeout(poll, 10);
      };
      poll();
    }), [PAGE_GLOBAL, READY_MS] as const);
    ready.catch(() => undefined);
    const outcome = await Promise.race([ready, thrown]);
    if (outcome instanceof Error) {
      throw new Error(`node raster host: the page script threw before calling \`serveHeadlessPage\`: ${outcome.message}`, { cause: outcome });
    }
    if (!outcome) throw new Error(`node raster host: the page script never called \`serveHeadlessPage\` within ${READY_MS} ms`);
    return opened;
  } catch (err) {
    // A cleanup that fails too, as on a browser already gone, must not replace the error that caused it.
    await (options.browser ? context?.close() : browser.close())?.catch(() => undefined);
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
  /** Closes `drop` started without waiting, which `dispose` waits out. */
  const closing = new Set<Promise<void>>();

  async function call(args: NodeRenderArgs, format: PageRequest['format']): Promise<PageResult> {
    if (disposed) throw new Error('node raster host: render on a disposed host');
    const { scene, screen, ...rest } = args;
    // Refused here, a bad request rejects before any browser starts.
    const req = readPageRequest({
      ...rest, scene: sceneToWire(scene), format, ...(screen ? { screen: Array.from(screen) } : {}),
    });
    let { pending, opened } = await live();
    // Gone between renders, as a page that crashed while idle: open another rather than fail this render on it.
    if (gone(opened)) {
      drop(pending, opened);
      ({ pending, opened } = await live());
    }
    try {
      return await opened.page.evaluate(
        ([key, r]) => ((globalThis as unknown as Record<string, PageApi>)[key]!).render(r),
        [PAGE_GLOBAL, req] as const,
      );
    } catch (err) {
      // Gone during the render: the next render opens another rather than failing on it too.
      if (gone(opened)) drop(pending, opened);
      throw err;
    }
  }

  /** The open page, opening one if there is none. */
  async function live(): Promise<{ pending: Promise<Open>; opened: Open }> {
    opening ??= open(options).catch((err: unknown) => {
      opening = null;
      throw err;
    });
    const pending = opening;
    const opened = await pending;
    // Disposed while the page opened: the dispose closes it, and this render would fail as a closed page.
    if (disposed) throw new Error('node raster host: render on a disposed host');
    return { pending, opened };
  }

  /** A page crashed, or a page or browser gone for good. */
  function gone(opened: Open): boolean {
    return opened.crashed || opened.page.isClosed() || !opened.browser.isConnected();
  }

  /** Forget a page that is gone, so the next render opens another, unless another render already did. */
  function drop(pending: Promise<Open>, opened: Open): void {
    if (opening !== pending) return;
    opening = null;
    const closed = close(opened).catch(() => undefined).finally(() => closing.delete(closed));
    closing.add(closed);
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
    const opened = pending ? await pending.catch(() => null) : null;
    await Promise.all([...closing, opened ? close(opened) : undefined]);
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
