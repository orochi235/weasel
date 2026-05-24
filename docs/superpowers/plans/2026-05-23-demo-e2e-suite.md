# Demo E2E Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land a Playwright-based, interaction-driven test suite for demos, with three pilots (move, bezier-edit, zoom) and a reusable test-hook + fixture pattern that scales to all ~40 demos.

**Architecture:** A new `tests/e2e/` Playwright project drives real input against demos. Demos expose structured scene state via `window.__weaselTest`, attached by `SceneCanvas` only when (a) the URL contains `?test=1` and (b) the build is non-production. A `demo` test fixture wraps navigation, scene-coord input, structured assertions, and a console-error gate.

**Tech Stack:** Playwright 1.x (already a dep), Vite dev server on port 5175, TypeScript.

**Spec:** `docs/superpowers/specs/2026-05-23-demo-e2e-suite-design.md`

---

## File map

**Created:**

- `src/test-hook/types.ts` — `WeaselTestHook` interface, global window augmentation.
- `src/test-hook/createTestHook.ts` — pure factory that builds a hook bound to a scene/selection/view ref bundle.
- `src/test-hook/createTestHook.test.ts` — unit test for the factory.
- `src/test-hook/install.ts` — `installTestHookIfRequested(refs)` — gates on URL + build mode, attaches to `window`.
- `tests/e2e/playwright.config.ts`
- `tests/e2e/fixtures.ts` — `demo` fixture (`test`, `expect` re-exports).
- `tests/e2e/helpers/coords.ts` — scene-coord → CSS-pixel translation.
- `tests/e2e/helpers/coords.test.ts` — unit test for the projection math.
- `tests/e2e/move.spec.ts`
- `tests/e2e/zoom.spec.ts`
- `tests/e2e/bezier-edit.spec.ts`
- `tests/e2e/README.md` — "how to add a demo to the suite".

**Modified:**

- `src/canvas/SceneCanvas.tsx` — call `installTestHookIfRequested` once on mount with the relevant refs.
- `demo/demos/BezierEditDemo.tsx` — register a `handles` probe (only file touched outside of test plumbing).
- `package.json` — `test:e2e:demos` script.
- `vitest.config.ts` — exclude `tests/e2e/**` from vitest (it's already not under any project root, but verify).

---

## Pre-flight

- [ ] **Step 1: Confirm working tree is clean and we're on a feature branch**

```bash
git status
git switch -c demo-e2e-suite
```

Expected: branch created.

- [ ] **Step 2: Confirm Playwright is installed**

```bash
node -e "console.log(require('@playwright/test/package.json').version)"
npx playwright --version
```

Expected: both print a version. If `npx playwright` fails to find browsers, run `npx playwright install chromium`.

---

## Task 1: Test-hook types and factory

The hook is built in two halves: a pure factory (this task) and the install gate (Task 2). Splitting keeps the factory unit-testable without touching `window`.

The hook surface — note `view` is `{ x, y, scale: { x, y } }` per `src/core/viewport/view.ts`, NOT `{ x, y, zoom }` as the spec sketched. We expose the real shape.

**Files:**

- Create: `src/test-hook/types.ts`
- Create: `src/test-hook/createTestHook.ts`
- Create: `src/test-hook/createTestHook.test.ts`

- [ ] **Step 1: Write the types**

```ts
// src/test-hook/types.ts
import type { Scene, SerializedScene } from 'core/scene/types';
import type { View } from 'core/viewport/view';

/** Refs the hook reads from. All are "current value" getters so the
 *  hook always sees the latest state, never a stale closure. */
export interface TestHookRefs {
  getScene: () => Scene<unknown, string, unknown> | null;
  getSelectionIds: () => readonly string[];
  getView: () => View;
  getActiveToolId: () => string | null;
}

export interface WeaselTestHook {
  /** Resolves once SceneCanvas has rendered at least once. */
  readonly ready: Promise<void>;
  /** Snapshot of the current scene. Throws if scene not yet mounted. */
  getScene(): SerializedScene<unknown, string, unknown>;
  /** Ids of currently selected nodes (empty array if none). */
  getSelection(): string[];
  /** Current view: { x, y, scale: { x, y } }. */
  getView(): View;
  /** Active tool id, or null if no tool is active. */
  getActiveToolId(): string | null;
  /** Read a demo-registered probe value. Returns undefined if no probe with that name is registered. */
  probe<T = unknown>(name: string): T | undefined;
  /** Register a probe. Returns a disposer that unregisters it. */
  registerProbe<T>(name: string, fn: () => T): () => void;
  /** Internal: SceneCanvas calls this after first render. */
  _markReady(): void;
}

declare global {
  interface Window {
    __weaselTest?: WeaselTestHook;
  }
}
```

- [ ] **Step 2: Write the factory test (failing)**

```ts
// src/test-hook/createTestHook.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createTestHook } from './createTestHook';
import type { TestHookRefs } from './types';

function refs(overrides: Partial<TestHookRefs> = {}): TestHookRefs {
  const fakeScene = { toJSON: () => ({ version: 1, systemLayers: [], nodes: [] }) } as never;
  return {
    getScene: () => fakeScene,
    getSelectionIds: () => [],
    getView: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
    getActiveToolId: () => null,
    ...overrides,
  };
}

describe('createTestHook', () => {
  it('ready resolves only after _markReady is called', async () => {
    const hook = createTestHook(refs());
    let resolved = false;
    void hook.ready.then(() => { resolved = true; });
    await Promise.resolve();
    expect(resolved).toBe(false);
    hook._markReady();
    await hook.ready;
    expect(resolved).toBe(true);
  });

  it('getScene returns the serialized snapshot', () => {
    const hook = createTestHook(refs());
    expect(hook.getScene()).toEqual({ version: 1, systemLayers: [], nodes: [] });
  });

  it('getScene throws if scene is not mounted', () => {
    const hook = createTestHook(refs({ getScene: () => null }));
    expect(() => hook.getScene()).toThrow(/scene not mounted/i);
  });

  it('getSelection returns a fresh array each call', () => {
    let ids: string[] = ['a'];
    const hook = createTestHook(refs({ getSelectionIds: () => ids }));
    expect(hook.getSelection()).toEqual(['a']);
    ids = ['a', 'b'];
    expect(hook.getSelection()).toEqual(['a', 'b']);
  });

  it('probe returns undefined for unknown names', () => {
    const hook = createTestHook(refs());
    expect(hook.probe('nope')).toBeUndefined();
  });

  it('registered probes return their fn value; disposer unregisters', () => {
    const hook = createTestHook(refs());
    const fn = vi.fn(() => 42);
    const dispose = hook.registerProbe('answer', fn);
    expect(hook.probe<number>('answer')).toBe(42);
    expect(fn).toHaveBeenCalledTimes(1);
    dispose();
    expect(hook.probe('answer')).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

```bash
npx vitest run src/test-hook/createTestHook.test.ts
```

Expected: FAIL — `createTestHook` not exported.

- [ ] **Step 4: Implement the factory**

```ts
// src/test-hook/createTestHook.ts
import type { TestHookRefs, WeaselTestHook } from './types';

export function createTestHook(refs: TestHookRefs): WeaselTestHook {
  let resolveReady!: () => void;
  const ready = new Promise<void>((r) => { resolveReady = r; });
  const probes = new Map<string, () => unknown>();

  return {
    ready,
    getScene() {
      const s = refs.getScene();
      if (!s) throw new Error('weasel test hook: scene not mounted yet');
      return s.toJSON();
    },
    getSelection() {
      return [...refs.getSelectionIds()];
    },
    getView() {
      return refs.getView();
    },
    getActiveToolId() {
      return refs.getActiveToolId();
    },
    probe<T = unknown>(name: string): T | undefined {
      const fn = probes.get(name);
      return fn ? (fn() as T) : undefined;
    },
    registerProbe<T>(name: string, fn: () => T) {
      probes.set(name, fn as () => unknown);
      return () => {
        if (probes.get(name) === fn) probes.delete(name);
      };
    },
    _markReady() {
      resolveReady();
    },
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/test-hook/createTestHook.test.ts
```

Expected: PASS, 6/6.

- [ ] **Step 6: Commit**

```bash
git add src/test-hook/types.ts src/test-hook/createTestHook.ts src/test-hook/createTestHook.test.ts
git commit -m "feat(test-hook): scene/view/selection introspection factory"
```

---

## Task 2: Install gate + SceneCanvas wiring

The install module reads the URL and build mode and attaches the hook to `window`. SceneCanvas calls it once on mount with refs that always read live state.

**Files:**

- Create: `src/test-hook/install.ts`
- Modify: `src/canvas/SceneCanvas.tsx` (one `useEffect` block + imports)

- [ ] **Step 1: Write `install.ts`**

```ts
// src/test-hook/install.ts
import { createTestHook } from './createTestHook';
import type { TestHookRefs, WeaselTestHook } from './types';

/** Attach `window.__weaselTest` and return the hook iff
 *    - `import.meta.env.MODE !== 'production'` (never in published kit bundles), AND
 *    - the URL contains `?test=1`.
 *  Otherwise returns null and does not touch `window`. */
export function installTestHookIfRequested(refs: TestHookRefs): WeaselTestHook | null {
  if (typeof window === 'undefined') return null;
  // Production bundles must never expose the hook, full stop.
  if (import.meta.env.MODE === 'production') return null;
  const params = new URLSearchParams(window.location.search);
  if (params.get('test') !== '1') return null;
  // If a hook is already installed (HMR), keep it.
  if (window.__weaselTest) return window.__weaselTest;
  const hook = createTestHook(refs);
  window.__weaselTest = hook;
  return hook;
}
```

- [ ] **Step 2: Locate the right spot in SceneCanvas**

Read `src/canvas/SceneCanvas.tsx` around lines 580–650 (where `scene`, `selection`, `view` are bound) to find a stable location for the install effect. The effect must run once after the first render and have access to live refs for scene/selection/view/activeTool.

- [ ] **Step 3: Add the wiring to SceneCanvas**

Add imports near the other `from 'core/...'` imports:

```ts
import { installTestHookIfRequested } from '../test-hook/install';
import type { WeaselTestHook } from '../test-hook/types';
```

Inside the `SceneCanvas` component body (after `scene`, `selection`, and `view` are resolved, but before the JSX return), add:

```ts
// Test hook: opt-in via ?test=1, never in production builds. See src/test-hook.
const sceneRef = useRef(scene);
const selectionRef = useRef(selection);
const viewRef = useRef(view);
const activeToolRef = useRef<string | null>(null);
sceneRef.current = scene;
selectionRef.current = selection;
viewRef.current = view;

const testHookRef = useRef<WeaselTestHook | null>(null);
useEffect(() => {
  testHookRef.current = installTestHookIfRequested({
    getScene: () => sceneRef.current as never,
    getSelectionIds: () => selectionRef.current?.ids ?? [],
    getView: () => viewRef.current,
    getActiveToolId: () => activeToolRef.current,
  });
  // Mark ready after first paint.
  testHookRef.current?._markReady();
}, []);
```

Then, wherever SceneCanvas tracks the active tool id (look for the `dispatcher` / `activeTool` context), add a line to update `activeToolRef.current` when the active tool changes. If the active tool isn't easily reachable as a string here, leave it as `null` for now and add a probe in the demo instead — pilots don't require this.

- [ ] **Step 4: Run kit tests to verify no regression**

```bash
npx vitest run --project=kit
```

Expected: PASS. If any SceneCanvas test fails, the new `useEffect` is firing in jsdom and trying to read `window.location` — check that `installTestHookIfRequested` returns null cleanly under jsdom + no `?test=1`.

- [ ] **Step 5: Manual smoke — verify hook only attaches with `?test=1`**

```bash
npm run dev
```

In a browser:
1. Open `http://localhost:5173/#move` — DevTools console: `window.__weaselTest` should be `undefined`.
2. Open `http://localhost:5173/?test=1#move` — `window.__weaselTest` should be an object; `window.__weaselTest.getScene()` returns the scene snapshot.

Kill `npm run dev`.

- [ ] **Step 6: Commit**

```bash
git add src/test-hook/install.ts src/canvas/SceneCanvas.tsx
git commit -m "feat(test-hook): install on SceneCanvas behind ?test=1 + non-prod gate"
```

---

## Task 3: Playwright config + coordinate helper

The fixture and specs will translate scene coordinates to CSS pixels. That math gets its own unit test before any Playwright spec runs.

**Files:**

- Create: `tests/e2e/playwright.config.ts`
- Create: `tests/e2e/helpers/coords.ts`
- Create: `tests/e2e/helpers/coords.test.ts`
- Modify: `package.json` (add script)

- [ ] **Step 1: Write the coords helper test**

```ts
// tests/e2e/helpers/coords.test.ts
import { describe, it, expect } from 'vitest';
import { sceneToCss, type CanvasRect, type ViewLike } from './coords';

const rect: CanvasRect = { left: 100, top: 50, width: 800, height: 600 };

describe('sceneToCss', () => {
  it('identity view: scene point maps to rect.origin + point', () => {
    const view: ViewLike = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    expect(sceneToCss([10, 20], view, rect)).toEqual([110, 70]);
  });

  it('view pan shifts the mapped point in the opposite direction', () => {
    const view: ViewLike = { x: 30, y: 0, scale: { x: 1, y: 1 } };
    // A scene point at (10, 0) under pan x=30 is drawn 30px further left.
    expect(sceneToCss([10, 0], view, rect)).toEqual([80, 50]);
  });

  it('view zoom scales the mapped offset', () => {
    const view: ViewLike = { x: 0, y: 0, scale: { x: 2, y: 2 } };
    expect(sceneToCss([10, 20], view, rect)).toEqual([120, 90]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npx vitest run tests/e2e/helpers/coords.test.ts
```

Expected: FAIL — `sceneToCss` not exported.

- [ ] **Step 3: Implement `coords.ts`**

Mirror the projection done by `viewToTransform`/`useCanvasSize`: scene → view-space → CSS pixels relative to the canvas rect.

```ts
// tests/e2e/helpers/coords.ts
export interface ViewLike { x: number; y: number; scale: { x: number; y: number } }
export interface CanvasRect { left: number; top: number; width: number; height: number }

/** Convert a scene-space point to CSS pixels (relative to the viewport).
 *  Matches weasel's view convention: drawn = (scene - view.xy) * view.scale,
 *  then offset by the canvas's bounding rect. */
export function sceneToCss(
  [sx, sy]: readonly [number, number],
  view: ViewLike,
  rect: CanvasRect,
): [number, number] {
  return [
    rect.left + (sx - view.x) * view.scale.x,
    rect.top + (sy - view.y) * view.scale.y,
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run tests/e2e/helpers/coords.test.ts
```

Expected: PASS, 3/3.

- [ ] **Step 5: Write the Playwright config**

```ts
// tests/e2e/playwright.config.ts
import { defineConfig } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');

export default defineConfig({
  testDir: here,
  testMatch: /\.spec\.ts$/,
  use: {
    baseURL: 'http://localhost:5175',
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npx vite --config vite.config.ts --port 5175',
    cwd: repoRoot,
    port: 5175,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  retries: 0,
  // Default workers — specs are independent.
});
```

- [ ] **Step 6: Add the npm script**

Edit `package.json` `scripts` block, add (alongside existing `test:e2e:swill`):

```json
"test:e2e:demos": "playwright test --config=tests/e2e/playwright.config.ts",
```

- [ ] **Step 7: Verify the config can be loaded (no specs yet — should report 0 tests)**

```bash
npm run test:e2e:demos -- --list
```

Expected: Playwright lists 0 tests (no spec files yet), exits 0.

- [ ] **Step 8: Commit**

```bash
git add tests/e2e/playwright.config.ts tests/e2e/helpers/coords.ts tests/e2e/helpers/coords.test.ts package.json
git commit -m "feat(test): tests/e2e Playwright project + scene-coord helper"
```

---

## Task 4: `demo` fixture

The fixture wraps navigation, scene introspection, and input. It also installs a console/pageerror gate that fails the test at teardown unless explicitly allowlisted.

**Files:**

- Create: `tests/e2e/fixtures.ts`

- [ ] **Step 1: Write the fixture**

```ts
// tests/e2e/fixtures.ts
import { test as base, expect, type Page } from '@playwright/test';
import { sceneToCss, type ViewLike, type CanvasRect } from './helpers/coords';

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
    // Wait for hook + ready.
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

  /** Locate the active demo's main canvas element. The demos all render
   *  a single <canvas> inside the active demo panel; we take the last one
   *  on the page to avoid picking up icon canvases in the demo nav. */
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
```

- [ ] **Step 2: Commit (no spec yet — fixture-only commit so the next task is small)**

```bash
git add tests/e2e/fixtures.ts
git commit -m "feat(test): tests/e2e demo fixture"
```

---

## Task 5: Move pilot

Drives a drag on a known starting item. The move demo renders three items with stable ids `a`, `b`, `c` at known poses (see `demo/demos/MoveDemo.tsx`). We drag `a` from its center by (80, 40).

**Files:**

- Create: `tests/e2e/move.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/move.spec.ts
import { test, expect } from './fixtures';

interface RectPose { x: number; y: number; width: number; height: number }

test('move — drag translates the dragged item by the gesture delta', async ({ demo }) => {
  await demo.goto('move');
  const before = await demo.getScene();
  const a = before.nodes.find((n) => n.id === 'a');
  expect(a, 'demo seeds item with id "a"').toBeTruthy();
  const pose = a!.pose as RectPose;
  const center: [number, number] = [pose.x + pose.width / 2, pose.y + pose.height / 2];

  await demo.dragScene({ from: center, by: [80, 40] });

  const after = await demo.getScene();
  const aAfter = after.nodes.find((n) => n.id === 'a')!;
  const poseAfter = aAfter.pose as RectPose;
  // Snap is on (20-unit tiles), so we tolerate snap-to-grid: expect within one tile.
  expect(Math.abs(poseAfter.x - (pose.x + 80))).toBeLessThanOrEqual(20);
  expect(Math.abs(poseAfter.y - (pose.y + 40))).toBeLessThanOrEqual(20);
  // The non-dragged item must not have moved.
  const bBefore = before.nodes.find((n) => n.id === 'b')!.pose as RectPose;
  const bAfter = after.nodes.find((n) => n.id === 'b')!.pose as RectPose;
  expect(bAfter).toEqual(bBefore);
});
```

- [ ] **Step 2: Run the spec**

```bash
npm run test:e2e:demos -- move.spec.ts
```

Expected: PASS.

If it fails: open the trace (Playwright writes one on failure with `--trace on-first-retry`; add `--trace on` to force) and check (a) whether the click landed on item `a` (likely a coords-helper bug) or (b) whether selection happened but the drag didn't translate (likely the gesture was below the move tool's threshold — increase `steps` or use a larger `by`).

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/move.spec.ts
git commit -m "test(e2e): move pilot — drag translates item by gesture delta"
```

---

## Task 6: Zoom pilot

The zoom demo uses `useZoom` with wheel input. The assertion is the "anchor invariant": after a wheel zoom centered on a point P, P stays under the cursor's CSS position (within 1px).

**Files:**

- Create: `tests/e2e/zoom.spec.ts`

- [ ] **Step 1: Read `demo/demos/ZoomDemo.tsx` to confirm**

```bash
cat demo/demos/ZoomDemo.tsx
```

Confirm: the demo uses wheel zoom, has a canvas with a known size, and (probably) does not snap zoom values.

- [ ] **Step 2: Write the spec**

```ts
// tests/e2e/zoom.spec.ts
import { test, expect } from './fixtures';
import { sceneToCss } from './helpers/coords';

test('zoom — wheel zoom keeps the cursor-anchored scene point pinned', async ({ demo }) => {
  await demo.goto('zoom');

  const viewBefore = await demo.getView();
  // Pick an off-center scene point so any anchor bug becomes visible.
  const scenePoint: [number, number] = [120, 90];
  // CSS position of that scene point BEFORE the wheel — that's the cursor location.
  const rectBefore = await demo.page.locator('canvas').last().boundingBox();
  expect(rectBefore).toBeTruthy();
  const [cssX, cssY] = sceneToCss(scenePoint, viewBefore, rectBefore!);

  await demo.page.mouse.move(cssX, cssY);
  await demo.page.mouse.wheel(0, -200); // negative deltaY = zoom in, on most demos

  const viewAfter = await demo.getView();
  expect(viewAfter.scale.x).toBeGreaterThan(viewBefore.scale.x);

  // After zoom, the same scene point should map to a CSS position near (cssX, cssY).
  const rectAfter = await demo.page.locator('canvas').last().boundingBox();
  const [cssX2, cssY2] = sceneToCss(scenePoint, viewAfter, rectAfter!);
  expect(Math.abs(cssX2 - cssX)).toBeLessThanOrEqual(1);
  expect(Math.abs(cssY2 - cssY)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 3: Run the spec**

```bash
npm run test:e2e:demos -- zoom.spec.ts
```

Expected: PASS.

If the wheel direction is reversed in the demo (zoom out instead of in), swap the sign on `deltaY` and update the comment. If the scale doesn't change at all, the wheel event isn't reaching the demo's `onWheel` — check that `mouse.move` landed on the canvas (it should, given we computed CSS coords from the canvas rect).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/zoom.spec.ts
git commit -m "test(e2e): zoom pilot — wheel anchor invariant"
```

---

## Task 7: Bezier-edit pilot + handles probe

The bezier-edit demo needs a small extension: it must register a `handles` probe so the spec can read handle positions structurally. The probe lives in the demo (not the kit), because handles are demo-state, not scene-state.

**Files:**

- Modify: `demo/demos/BezierEditDemo.tsx`
- Create: `tests/e2e/bezier-edit.spec.ts`

- [ ] **Step 1: Read BezierEditDemo to find the handle data source**

```bash
cat demo/demos/BezierEditDemo.tsx
```

Find the state that drives handle rendering (likely a state ref of path points + handles, or a callback from a pen-edit hook). The probe should return an array of `{ vertexIndex, handleIn?: [x,y], handleOut?: [x,y], anchor: [x,y] }` records — or whatever shape mirrors the demo's actual handle state. Pick a shape that's a verbatim mirror of what the demo already holds — do not invent a parallel structure.

- [ ] **Step 2: Register the probe inside BezierEditDemo**

Inside the component, after the handle-state ref/value is available, add:

```ts
useEffect(() => {
  if (typeof window === 'undefined') return;
  const hook = window.__weaselTest;
  if (!hook) return;
  return hook.registerProbe('handles', () => /* return current handle state, deep-cloned for safety */ JSON.parse(JSON.stringify(handlesStateRef.current)));
}, []);
```

Use whatever ref/state name actually exists in the demo. The `JSON.parse(JSON.stringify(...))` clone is intentional: probes must return a snapshot, not a live reference that mutates under the test.

- [ ] **Step 3: Verify the probe is reachable**

```bash
npm run dev
```

Open `http://localhost:5173/?test=1#bezier-edit`. In DevTools:

```js
await window.__weaselTest.ready;
window.__weaselTest.probe('handles');
```

Expected: an array (or object) of handle data matching the demo's current state.

Kill `npm run dev`.

- [ ] **Step 4: Write the spec**

```ts
// tests/e2e/bezier-edit.spec.ts
import { test, expect } from './fixtures';

// Shape of the handles probe — adjust if Task 7 Step 1 picked a different shape.
type HandleEntry = { vertexIndex: number; anchor: [number, number]; handleIn?: [number, number]; handleOut?: [number, number] };

test('bezier-edit — dragging a handle moves the handle, not the anchor', async ({ demo }) => {
  await demo.goto('bezier-edit');
  const handlesBefore = (await demo.probe<HandleEntry[]>('handles'))!;
  expect(handlesBefore.length).toBeGreaterThan(0);
  // Pick the first handle that exposes an `handleOut`.
  const target = handlesBefore.find((h) => h.handleOut);
  expect(target, 'demo seeds at least one vertex with an out-handle').toBeTruthy();
  const startHandle = target!.handleOut!;
  const startAnchor = target!.anchor;

  await demo.dragScene({ from: startHandle, by: [25, -15] });

  const handlesAfter = (await demo.probe<HandleEntry[]>('handles'))!;
  const after = handlesAfter.find((h) => h.vertexIndex === target!.vertexIndex)!;
  // Handle moved by (25, -15) within 1px.
  expect(Math.abs(after.handleOut![0] - (startHandle[0] + 25))).toBeLessThanOrEqual(1);
  expect(Math.abs(after.handleOut![1] - (startHandle[1] - 15))).toBeLessThanOrEqual(1);
  // Anchor did not move.
  expect(after.anchor).toEqual(startAnchor);
});
```

- [ ] **Step 5: Run the spec**

```bash
npm run test:e2e:demos -- bezier-edit.spec.ts
```

Expected: PASS.

If the spec can't find a handle to drag because the demo doesn't show handles until a vertex is activated: the spec must first `clickScene(startAnchor)` to enter edit mode for that vertex, then re-read the probe. Add that step before the drag if needed.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/BezierEditDemo.tsx tests/e2e/bezier-edit.spec.ts
git commit -m "test(e2e): bezier-edit pilot + handles probe in demo"
```

---

## Task 8: Run all three pilots + add README

- [ ] **Step 1: Run the full e2e suite**

```bash
npm run test:e2e:demos
```

Expected: 3 passed.

- [ ] **Step 2: Run the full repo test gate locally (matches `prepublishOnly`)**

```bash
npx tsc --noEmit
npx vitest run
npx tsup
```

Expected: all three green. The new hook is gated, so production typecheck must not pull in any test-only symbols incorrectly, and the `tsup` build must NOT bundle `src/test-hook/install.ts` into a consumer-reachable entrypoint. Verify by grepping the dist: `grep -r '__weaselTest' dist/` should return no matches (the production-mode guard makes the install body dead code, and tree-shaking should drop it).

- [ ] **Step 3: Write `tests/e2e/README.md`**

```markdown
# tests/e2e — interaction-driven demo tests

Each spec navigates to a demo with `?test=1`, drives real input via Playwright, and asserts on scene/view/probe state read from `window.__weaselTest`.

## Run

    npm run test:e2e:demos

## Add a demo

1. Pick a demo id (the hash in its URL — e.g. `move`, `bezier-edit`, `zoom`).
2. Decide what to assert on. Choose the smallest, most structural assertion:
   - Scene snapshot (`demo.getScene()`) — for anything that mutates the scene.
   - View (`demo.getView()`) — for viewport gestures.
   - Selection (`demo.getSelection()`) — for selection behavior.
   - A demo-registered probe (`demo.probe('name')`) — only when the assertion is about demo-local state, not kit state. Register the probe inside the demo with `window.__weaselTest?.registerProbe`.
3. Copy `move.spec.ts` as a template.
4. Run it: `npm run test:e2e:demos -- yourdemo.spec.ts`.

The fixture (`fixtures.ts`) auto-fails the test on any console/page error. Use `demo.expectConsoleError(/regex/)` to allowlist expected errors for negative tests.

## Why this is separate from `tests/visual/`

`tests/visual/` is mount-and-snapshot only — strict pixel baselines, serial workers, fixed viewport. This suite drives interactions and asserts on structured state. Mixing them would muddy the baselines.
```

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/README.md
git commit -m "docs(test): how to add a demo to the e2e suite"
```

---

## Done check

- [ ] `npm run test:e2e:demos` is green with three pilots.
- [ ] `window.__weaselTest` is `undefined` on the demo site without `?test=1`.
- [ ] `npm run -s typecheck && npm test` is green.
- [ ] `tests/e2e/README.md` documents how to add a demo.
- [ ] No `@internal` types are reachable from the demo's `BezierEditDemo.tsx` — the `WeaselTestHook` global is the only contact surface.

Do NOT push without explicit user confirmation.
