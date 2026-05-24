import { test as base, expect, type Page } from '@playwright/test';
import { sceneToCss, type ViewLike, type CanvasRect } from './helpers/coords';

declare global {
  interface Window {
    __weaselTest?: {
      ready: Promise<void>;
      getScene(): unknown;
      getSelection(): string[];
      getView(): unknown;
      getActiveToolId(): string | null;
      probe(name: string): unknown;
    };
  }
}

interface SerializedSceneLike {
  version: 1;
  nodes: Array<{ id: string; pose: unknown; data: unknown; layer: string; kind: string }>;
}

export class Demo {
  private allowedErrors: RegExp[] = [];
  readonly errors: string[] = [];

  constructor(readonly page: Page) {}

  async goto(demoId: string) {
    await this.page.goto(`/?test=1#${demoId}`);
    // Wait for the hook to attach + the demo's SceneCanvas to mark ready.
    await this.page.waitForFunction(() => Boolean(window.__weaselTest));
    await this.page.evaluate(() => window.__weaselTest!.ready);
  }

  async getScene(): Promise<SerializedSceneLike> {
    return this.page.evaluate(() => window.__weaselTest!.getScene() as SerializedSceneLike);
  }
  async getSelection(): Promise<string[]> {
    return this.page.evaluate(() => window.__weaselTest!.getSelection());
  }
  async getView(): Promise<ViewLike> {
    return this.page.evaluate(() => window.__weaselTest!.getView() as ViewLike);
  }
  async getActiveToolId(): Promise<string | null> {
    return this.page.evaluate(() => window.__weaselTest!.getActiveToolId());
  }
  async probe<T = unknown>(name: string): Promise<T | undefined> {
    return this.page.evaluate((n) => window.__weaselTest!.probe(n) as T | undefined, name);
  }

  /** Bounding box of the active demo's main canvas. Demos render a single
   *  visible <canvas>; we take the last canvas on the page to avoid picking
   *  up icon canvases in the demo nav (if any). */
  private async canvasRect(): Promise<CanvasRect> {
    const handle = this.page.locator('canvas').last();
    const box = await handle.boundingBox();
    if (!box) throw new Error('canvas has no bounding box');
    return box;
  }

  async sceneToCss(point: readonly [number, number]): Promise<[number, number]> {
    const [view, rect] = await Promise.all([this.getView(), this.canvasRect()]);
    return sceneToCss(point, view, rect);
  }

  async dragScene(opts: {
    from: readonly [number, number];
    to?: readonly [number, number];
    by?: readonly [number, number];
    steps?: number;
  }) {
    const to: [number, number] = opts.to
      ? [opts.to[0], opts.to[1]]
      : [opts.from[0] + (opts.by?.[0] ?? 0), opts.from[1] + (opts.by?.[1] ?? 0)];
    const [fx, fy] = await this.sceneToCss(opts.from);
    const [tx, ty] = await this.sceneToCss(to);
    await this.page.mouse.move(fx, fy);
    await this.page.mouse.down();
    await this.page.mouse.move(tx, ty, { steps: opts.steps ?? 10 });
    await this.page.mouse.up();
  }

  async clickScene(point: readonly [number, number]) {
    const [cx, cy] = await this.sceneToCss(point);
    await this.page.mouse.click(cx, cy);
  }

  async wheelAtScene(point: readonly [number, number], delta: { dx?: number; dy?: number }) {
    const [cx, cy] = await this.sceneToCss(point);
    await this.page.mouse.move(cx, cy);
    await this.page.mouse.wheel(delta.dx ?? 0, delta.dy ?? 0);
  }

  expectConsoleError(re: RegExp) {
    this.allowedErrors.push(re);
  }

  _recordError(text: string) {
    this.errors.push(text);
  }

  _unallowedErrors(): string[] {
    return this.errors.filter((e) => !this.allowedErrors.some((re) => re.test(e)));
  }
}

export const test = base.extend<{ demo: Demo }>({
  demo: async ({ page }, use) => {
    const demo = new Demo(page);
    page.on('pageerror', (err) => demo._recordError(`pageerror: ${err.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') demo._recordError(`console.error: ${msg.text()}`);
    });
    await use(demo);
    const unallowed = demo._unallowedErrors();
    if (unallowed.length > 0) {
      throw new Error(`Unexpected console/page errors:\n  - ${unallowed.join('\n  - ')}`);
    }
  },
});

export { expect };
