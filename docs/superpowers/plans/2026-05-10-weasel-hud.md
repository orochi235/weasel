# weasel-hud Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up `@weasel-js/hud` v1 — an imperative, retained-mode WebGL UI widget package that renders into a weasel canvas via the existing renderer pipeline. Ships `rect`, `text`, `image`, `label`, and `button`; pre-empts the canvas's tool dispatcher; vanilla core with a React subpath.

**Architecture:** Three-stage build. Stage A lands a **Canvas extension API** on weasel core (`requestRedraw`, `registerLayer`, `installPointerInterceptor`) — a precondition called out in the spec. Stage B builds the HUD core: `Hud` orchestrator, `Widget` protocol, `HudHost` adapter, `attachHud`, default-font auto-registration. Stage C ships the v1 widgets (rect, text, image, label, button) and the React subpath, then proves end-to-end with an integration test and a demo.

**Tech Stack:** TypeScript (vanilla core, no React in the package's main entry), Vitest, jsdom, the existing `WeaselRenderer` + `RenderLayer` + `tools.dispatcher` machinery, `registerFont` MSDF text path. React 18 in the optional subpath only.

**Spec:** `docs/specs/2026-05-10-weasel-hud-design.md`

---

## Post-rebase amendment (2026-05-10, mid-execution)

After Task A1 and A2 were committed, the worktree was rebased onto `main`,
which had picked up a substantial chrome-affordance system in the interim:

- `RenderLayer<TData>` gained an optional `hitTest(worldX, worldY, data, view, dims): HitResult | null`
- `ToolsDispatcher` integrated a hit-test pipeline via `getHitTestContext` —
  on pointerdown, the dispatcher walks visible layers top-down, consults each
  layer's `hitTest`, and routes a claim into the affordance's drag channel
  before falling through to the active-tool slot walk
- `Affordance` and `HitResult` types live in `src/affordances/`
- A tool can opt out via `claimsAll(ctx)`

**Consequence for this plan:**

- **Task A4 (`installPointerInterceptor`) is deleted.** The dispatcher pipeline
  already provides the input-claim mechanism the HUD needs. The HUD's layer
  will simply implement `RenderLayer.hitTest` and participate in the standard
  pipeline. `CanvasExtensionApi` is simplified to `{ element, requestRedraw, registerLayer }`.
- **Stage A is now A1, A2, A3.**
- **Stage B's input model changes** (Task B4): instead of installing a separate
  pointer interceptor, `attachHud` registers a single `RenderLayer<unknown>`
  whose `hitTest` walks the HUD's widget list, converts world→screen, and
  returns a `HitResult` whose drag channel routes events to the hit widget's
  `onPointer`. The widget protocol from Task B1 stays as designed — the change
  is purely in how the HUD layer wraps it for the dispatcher.
- **B4's detailed implementation will be re-specified when we get there**,
  because it needs to model a `HitResult`'s drag channel and that wasn't
  expressible in the original plan. Tasks B1, B2, B3 are unchanged.

The interface code touched by this amendment (`canvasExtension.ts`, the
`useImperativeHandle` in `Canvas.tsx`, the related test, and the `index.ts`
re-export) is updated in the same commit as this note.

---

## File Structure

**Stage A — Canvas extension API (weasel core)** *(A4 removed; see amendment above)*
- Modify: `src/canvas/Canvas.tsx` — add ref-exposed `requestRedraw`, `registerLayer`; merge registered layers into the layer stack
- Modify: `src/canvas/Canvas.test.tsx` — coverage for the two hooks
- Create: `src/canvas/canvasExtension.ts` — `CanvasExtensionApi` type
- Modify: `src/index.ts` — export the new type

**Stage B — HUD core (no widgets)**
- Create: `packages/hud/src/widget.ts` — `Widget`, `HudPointerEvent`, `HudDrawCtx` types
- Create: `packages/hud/src/host.ts` — `HudHost` interface
- Create: `packages/hud/src/hud.ts` — `Hud` class, `createHud()` factory
- Create: `packages/hud/src/hud.test.ts`
- Create: `packages/hud/src/fonts/inter.json` — copy of `assets/fonts/inter/inter.json`
- Create: `packages/hud/src/fonts/inter.png` — copy of `assets/fonts/inter/inter.png`
- Create: `packages/hud/src/fonts/registerDefaultFont.ts`
- Create: `packages/hud/src/fonts/registerDefaultFont.test.ts`
- Create: `packages/hud/src/attach.ts` — `attachHud(canvas, hud)`
- Create: `packages/hud/src/attach.test.ts`
- Modify: `packages/hud/src/index.ts` — barrel
- Modify: `packages/hud/package.json` — add `@weasel-js/hud/react` subpath

**Stage C — Widgets + React + integration**
- Create: `packages/hud/src/widgets/rect.ts` + test
- Create: `packages/hud/src/widgets/text.ts` + test
- Create: `packages/hud/src/widgets/image.ts` + test
- Create: `packages/hud/src/widgets/label.ts` + test
- Create: `packages/hud/src/widgets/button.ts` + test
- Create: `packages/hud/src/react/index.ts`
- Create: `packages/hud/src/react/useHud.ts`
- Create: `packages/hud/src/react/useHud.test.tsx`
- Create: `packages/hud/src/integration.test.tsx`
- Create: `demo/demos/HudDemo.tsx` + entry in the demo registry

---

## Stage A — Canvas extension API

The HUD package needs three hooks the canvas does not currently expose externally. Land them as a small, deliberate API on the canvas's imperative ref so future consumers (debug overlays, async loaders, weasel-hud) can plug in without touching internals.

### Task A1: define the extension API types

**Files:**
- Create: `src/canvas/canvasExtension.ts`

- [ ] **Step 1: Write the type module**

```ts
// src/canvas/canvasExtension.ts
import type { RenderLayer } from '../core/layers/render';

export interface CanvasExtensionApi {
  /** The underlying HTMLCanvasElement. Null until the canvas mounts. */
  readonly element: HTMLCanvasElement | null;
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
}
```

> **Note (post-rebase amendment):** Originally this API also included
> `installPointerInterceptor`. That has been removed — the new dispatcher
> hit-test pipeline (added on `main` between when this plan was written
> and when execution began) supersedes it. See the amendment at the top
> of this file. Task A4 is deleted.

- [ ] **Step 2: Re-export from the package barrel**

In `src/index.ts`, find the section that re-exports canvas types and append:

```ts
export type { CanvasExtensionApi } from './canvas/canvasExtension';
```

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/canvas/canvasExtension.ts src/index.ts
git commit -m "feat(canvas): introduce CanvasExtensionApi types

Two hooks for external consumers (HUDs, debug overlays, async asset
loaders) to plug into the canvas without touching internals:
requestRedraw and registerLayer. Plus `element` for direct canvas
access."
```

---

### Task A2: implement requestRedraw on Canvas

**Files:**
- Modify: `src/canvas/Canvas.tsx` — add an internal `redrawNonce` state and a `requestRedraw` method on the ref handle

- [ ] **Step 1: Write the failing test**

In `src/canvas/Canvas.test.tsx`, add:

```tsx
it('requestRedraw on the ref bumps the redraw effect', async () => {
  const drawSpy = vi.fn();
  const trackingLayer: RenderLayer<unknown> = {
    id: 'tracker', label: 'tracker', space: 'screen',
    draw: () => { drawSpy(); return []; },
  };
  const ref = React.createRef<CanvasExtensionApi>();
  render(
    <Canvas
      ref={ref}
      width={200} height={200}
      adapter={mockAdapter}
      items={[]} setItems={() => {}}
      layers={{ custom: [trackingLayer] }}
    />
  );
  await waitForFrame();
  const before = drawSpy.mock.calls.length;
  act(() => { ref.current?.requestRedraw(); });
  await waitForFrame();
  expect(drawSpy.mock.calls.length).toBeGreaterThan(before);
});
```

(`waitForFrame` is the existing helper in `src/renderer/test-utils/`; if not, use `await new Promise(r => requestAnimationFrame(r));`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/canvas/Canvas.test.tsx -t "requestRedraw"`
Expected: FAIL — Canvas does not yet expose a ref handle with `requestRedraw`.

- [ ] **Step 3: Add redrawNonce state and ref handle to Canvas**

In `src/canvas/Canvas.tsx`:

a. Wrap the existing `Canvas` function in `React.forwardRef` if it isn't already, with the imperative handle typed as `CanvasExtensionApi`. Confirm by searching for `forwardRef` in the file; if present, extend the existing imperative handle, otherwise wrap.

b. Add internal state near the top of the component body:

```tsx
const [redrawNonce, setRedrawNonce] = useState(0);
const requestRedraw = useCallback(() => setRedrawNonce(n => n + 1), []);
```

c. Add `redrawNonce` to the redraw effect's dep array (find the existing `useEffect` that calls into the renderer — line ~1149 — and append `redrawNonce` to its deps):

```tsx
}, [layersWithDebug, width, height, background, effectiveView, debugSink, redrawNonce]);
```

d. Expose via `useImperativeHandle`:

```tsx
useImperativeHandle(ref, () => ({
  requestRedraw,
  // registerLayer + installPointerInterceptor added in subsequent tasks
  registerLayer: () => () => {},
  installPointerInterceptor: () => () => {},
}), [requestRedraw]);
```

(The placeholder no-op stubs for the other two methods get real implementations in tasks A3 and A4. They're stubs *only* across this single commit — this is one of the rare cases where a placeholder is necessary because TypeScript needs the field to exist in the handle shape. Tasks A3 and A4 immediately replace them.)

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/canvas/Canvas.test.tsx -t "requestRedraw"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): expose requestRedraw via imperative ref handle"
```

---

### Task A3: implement registerLayer

**Files:**
- Modify: `src/canvas/Canvas.tsx` — extras-layer registry

- [ ] **Step 1: Write the failing test**

```tsx
it('registerLayer adds a layer to the active stack and detach removes it', async () => {
  const draws: number[] = [];
  const extra: RenderLayer<unknown> = {
    id: 'extra', label: 'extra', space: 'screen',
    draw: () => { draws.push(Date.now()); return []; },
  };
  const ref = React.createRef<CanvasExtensionApi>();
  render(
    <Canvas
      ref={ref}
      width={100} height={100}
      adapter={mockAdapter}
      items={[]} setItems={() => {}}
      layers={{}}
    />
  );
  await waitForFrame();
  const baseline = draws.length;

  let detach: (() => void) | undefined;
  act(() => { detach = ref.current?.registerLayer(extra); });
  await waitForFrame();
  expect(draws.length).toBeGreaterThan(baseline);

  const beforeDetach = draws.length;
  act(() => { detach?.(); });
  // trigger another frame
  act(() => { ref.current?.requestRedraw(); });
  await waitForFrame();
  expect(draws.length).toBe(beforeDetach);   // extra no longer drew
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/canvas/Canvas.test.tsx -t "registerLayer"`
Expected: FAIL — `registerLayer` is currently a no-op stub.

- [ ] **Step 3: Implement extras layer registry in Canvas**

```tsx
// Inside Canvas component body
const extrasRef = useRef<Set<RenderLayer<unknown>>>(new Set());
const registerLayer = useCallback((layer: RenderLayer<unknown>) => {
  extrasRef.current.add(layer);
  setRedrawNonce(n => n + 1);
  return () => {
    extrasRef.current.delete(layer);
    setRedrawNonce(n => n + 1);
  };
}, []);
```

Then update the existing `layersWithDebug` memo (around line 1075) to splice in extras:

```tsx
const layersWithDebug = useMemo(() => {
  const base = debugSink && resolvedDebugConfig
    ? [...layers, createDebugOverlayLayer({ sink: debugSink, config: resolvedDebugConfig })]
    : layers;
  return [...base, ...extrasRef.current];
}, [layers, debugSink, resolvedDebugConfig, redrawNonce]);
```

(The `redrawNonce` dep is what drives the memo to re-read `extrasRef`. We avoid `useState` for the extras set because Set mutations don't compare cheaply; the nonce is the explicit invalidation signal.)

Update `useImperativeHandle` to expose the real `registerLayer` (replacing the no-op stub from Task A2):

```tsx
useImperativeHandle(ref, () => ({
  requestRedraw,
  registerLayer,
  installPointerInterceptor: () => () => {},
}), [requestRedraw, registerLayer]);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/canvas/Canvas.test.tsx -t "registerLayer"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/canvas/Canvas.tsx src/canvas/Canvas.test.tsx
git commit -m "feat(canvas): registerLayer extension hook for external layer plumbing"
```

---

### ~~Task A4: installPointerInterceptor~~ — DELETED

See the post-rebase amendment at the top of this file. The dispatcher's
new hit-test pipeline subsumes this. Stage B's HUD layer participates in
that pipeline directly via `RenderLayer.hitTest`.

---

## Stage B — HUD core

### Task B1: define widget protocol and host types

**Files:**
- Create: `packages/hud/src/widget.ts`
- Create: `packages/hud/src/host.ts`

- [ ] **Step 1: Write the widget protocol module**

```ts
// packages/hud/src/widget.ts
import type { DrawCommand } from '../../../src/renderer';

export interface WidgetBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface HudDrawCtx {
  /** Canvas size in CSS pixels. */
  dims: { width: number; height: number };
  /** Family name of the auto-registered default font. */
  defaultFont: string;
}

export type HudPointerEvent =
  | { type: 'down'; x: number; y: number; native: PointerEvent }
  | { type: 'move'; x: number; y: number; native: PointerEvent }
  | { type: 'up'; x: number; y: number; native: PointerEvent }
  | { type: 'cancel'; native: PointerEvent }
  | { type: 'hovermove'; x: number; y: number; native: PointerEvent }
  | { type: 'hoverleave'; native: PointerEvent | null };

export type PointerClaim = 'claim' | 'pass';

export interface Widget {
  readonly id: string;
  readonly bounds: WidgetBounds;
  readonly hidden: boolean;
  draw(ctx: HudDrawCtx): DrawCommand[];
  hitTest(x: number, y: number): boolean;
  onPointer(evt: HudPointerEvent): PointerClaim;
  /** Called by Hud.remove or widget.dispose. Detach event listeners, etc. */
  dispose(): void;
}
```

- [ ] **Step 2: Write the host module**

```ts
// packages/hud/src/host.ts
import type { RenderLayer } from '../../../src/core/layers/render';

export type PointerInterceptor = (evt: PointerEvent) => 'claim' | 'pass';

export interface HudHost {
  requestRedraw(): void;
  registerLayer(layer: RenderLayer<unknown>): () => void;
  installPointerInterceptor(handler: PointerInterceptor): () => void;
}
```

(Note on imports: weasel-hud uses package-relative paths into the weasel source tree. The spec's open-question #4 is resolved here as "import via relative paths" — simpler than threading a new subpath through tsconfig/vitest aliases. The package is private and bundled with the weasel monorepo, so this is fine.)

- [ ] **Step 3: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add packages/hud/src/widget.ts packages/hud/src/host.ts
git commit -m "feat(weasel-hud): widget protocol and host interface"
```

---

### Task B2: implement Hud orchestrator (no widgets yet)

**Files:**
- Create: `packages/hud/src/hud.ts`
- Create: `packages/hud/src/hud.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/hud/src/hud.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createHud } from './hud';
import type { HudHost } from './host';
import type { Widget } from './widget';

function makeHost(): HudHost & { redrawCount: number } {
  const host = {
    redrawCount: 0,
    requestRedraw() { this.redrawCount++; },
    registerLayer: vi.fn(() => () => {}),
    installPointerInterceptor: vi.fn(() => () => {}),
  };
  return host;
}

function makeWidget(id: string): Widget {
  return {
    id, bounds: { x: 0, y: 0, w: 10, h: 10 }, hidden: false,
    draw: () => [], hitTest: () => false, onPointer: () => 'pass',
    dispose: () => {},
  };
}

describe('Hud', () => {
  it('add() inserts widget and requests redraw when bound', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    const w = makeWidget('w1');
    hud.add(w);
    expect(hud.widgets()).toEqual([w]);
    expect(host.redrawCount).toBe(1);
  });

  it('add() before bind queues without crashing; bind triggers initial redraw', () => {
    const hud = createHud();
    const w = makeWidget('w1');
    hud.add(w);
    expect(hud.widgets()).toEqual([w]);
    const host = makeHost();
    hud.bind(host);
    expect(host.redrawCount).toBe(1);
  });

  it('remove() drops widget and calls dispose', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    const dispose = vi.fn();
    const w = { ...makeWidget('w1'), dispose };
    hud.add(w);
    hud.remove(w);
    expect(hud.widgets()).toEqual([]);
    expect(dispose).toHaveBeenCalled();
  });

  it('markDirty triggers redraw when bound', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    hud.markDirty();
    expect(host.redrawCount).toBe(1);
  });

  it('markDirty before bind is a no-op (no crash, no redraw)', () => {
    const hud = createHud();
    expect(() => hud.markDirty()).not.toThrow();
  });

  it('detached HUD warns instead of throwing on widget add', () => {
    const hud = createHud();
    const host = makeHost();
    hud.bind(host);
    hud.unbind();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    hud.add(makeWidget('w1'));
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/hud/src/hud.test.ts`
Expected: FAIL — `createHud` doesn't exist.

- [ ] **Step 3: Implement Hud**

```ts
// packages/hud/src/hud.ts
import type { Widget } from './widget';
import type { HudHost } from './host';

export interface Hud {
  add(widget: Widget): void;
  remove(widget: Widget): void;
  widgets(): readonly Widget[];
  markDirty(): void;
  bind(host: HudHost): void;
  unbind(): void;
  /** True after bind() and before unbind(). */
  readonly attached: boolean;
}

export function createHud(): Hud {
  const list: Widget[] = [];
  let host: HudHost | null = null;
  let detached = false;

  const requestRedraw = () => { host?.requestRedraw(); };

  // NOTE: factory methods (rect, text, image, label, button) inject
  // `onChange: () => requestRedraw()` into widget options so widget setters
  // trigger redraws automatically. Widgets created via the bare factories
  // (createRect etc.) don't get this and must be added via hud.add() — their
  // setters won't auto-redraw, which is by design (the bare factories are
  // for unit tests and advanced consumers who want to manage redraws
  // explicitly).

  return {
    get attached() { return host !== null; },
    add(widget) {
      if (detached) {
        console.warn('weasel-hud: add() called on a detached HUD; ignored.');
        return;
      }
      list.push(widget);
      requestRedraw();
    },
    remove(widget) {
      const i = list.indexOf(widget);
      if (i === -1) return;
      list.splice(i, 1);
      try { widget.dispose(); } catch (e) {
        console.error('weasel-hud: widget.dispose threw', e);
      }
      requestRedraw();
    },
    widgets() { return list; },
    markDirty() { requestRedraw(); },
    bind(h) {
      if (host) throw new Error('weasel-hud: HUD is already bound to a host.');
      host = h;
      detached = false;
      requestRedraw();
    },
    unbind() {
      host = null;
      detached = true;
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/hud/src/hud.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/hud/src/hud.ts packages/hud/src/hud.test.ts
git commit -m "feat(weasel-hud): Hud orchestrator (bind/add/remove/markDirty)"
```

---

### Task B3: copy Inter atlas into weasel-hud + write registerDefaultFont

**Files:**
- Create: `packages/hud/src/fonts/inter.json` (binary copy)
- Create: `packages/hud/src/fonts/inter.png` (binary copy)
- Create: `packages/hud/src/fonts/registerDefaultFont.ts`
- Create: `packages/hud/src/fonts/registerDefaultFont.test.ts`

Resolves spec open-question #1 by bundling: weasel-hud is self-contained.

- [ ] **Step 1: Copy the atlas files**

```bash
mkdir -p packages/hud/src/fonts
cp assets/fonts/inter/inter.json packages/hud/src/fonts/inter.json
cp assets/fonts/inter/inter.png packages/hud/src/fonts/inter.png
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/hud/src/fonts/registerDefaultFont.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerDefaultFont, DEFAULT_FONT_FAMILY } from './registerDefaultFont';
import { _resetFontRegistryForTests, getFont } from '../../../../src/features/text/atlas/registerFont';

describe('registerDefaultFont', () => {
  beforeEach(() => { _resetFontRegistryForTests(); });

  it('registers a font under DEFAULT_FONT_FAMILY', async () => {
    // Mock fetch since jsdom doesn't load assets
    const interJson = await import('./inter.json');
    const fakePng = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' });
    global.fetch = vi.fn(async (url: string) => {
      if (url.endsWith('.json')) return new Response(JSON.stringify(interJson.default ?? interJson));
      if (url.endsWith('.png')) return new Response(fakePng);
      throw new Error('unexpected url ' + url);
    }) as never;

    await registerDefaultFont();
    expect(getFont(DEFAULT_FONT_FAMILY)).not.toBeNull();
  });

  it('is idempotent', async () => {
    global.fetch = vi.fn(async () => new Response('{}')) as never;
    await registerDefaultFont();
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.length;
    await registerDefaultFont();
    // registerFont in core dedupes by family — second call should be a no-op
    expect((global.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(fetchCalls);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run packages/hud/src/fonts/registerDefaultFont.test.ts`
Expected: FAIL — `registerDefaultFont` doesn't exist.

- [ ] **Step 4: Write registerDefaultFont**

```ts
// packages/hud/src/fonts/registerDefaultFont.ts
import { registerFont } from '../../../../src/features/text/atlas/registerFont';

// Vite/esbuild URL imports — these resolve to the bundled asset paths at build time.
// In dev, they resolve to dev-server URLs the renderer can fetch.
import metricsUrl from './inter.json?url';
import atlasUrl from './inter.png?url';

export const DEFAULT_FONT_FAMILY = 'weasel-hud-default';

export async function registerDefaultFont(): Promise<void> {
  await registerFont(DEFAULT_FONT_FAMILY, metricsUrl, atlasUrl);
}
```

(`?url` imports are a Vite/Vitest convention. If running outside Vite, the consumer can override by calling `registerFont(DEFAULT_FONT_FAMILY, ...)` themselves before `attachHud`.)

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run packages/hud/src/fonts/registerDefaultFont.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/hud/src/fonts/
git commit -m "feat(weasel-hud): bundle Inter atlas + registerDefaultFont helper"
```

---

### Task B4: attachHud — wire HUD to a Canvas extension API

**Files:**
- Create: `packages/hud/src/attach.ts`
- Create: `packages/hud/src/attach.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/hud/src/attach.test.ts
import { describe, it, expect, vi } from 'vitest';
import { attachHud } from './attach';
import { createHud } from './hud';
import type { CanvasExtensionApi } from '../../../src/canvas/canvasExtension';

function makeApi() {
  const detachLayer = vi.fn();
  const detachInterceptor = vi.fn();
  return {
    requestRedraw: vi.fn(),
    registerLayer: vi.fn(() => detachLayer),
    installPointerInterceptor: vi.fn(() => detachInterceptor),
  } satisfies CanvasExtensionApi;
}

describe('attachHud', () => {
  it('registers a screen-space layer and a pointer interceptor', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(api.registerLayer).toHaveBeenCalledTimes(1);
    expect(api.registerLayer.mock.calls[0][0].space).toBe('screen');
    expect(api.installPointerInterceptor).toHaveBeenCalledTimes(1);
  });

  it('returns a detach function that unregisters and unbinds', () => {
    const hud = createHud();
    const api = makeApi();
    const detach = attachHud(api, hud);
    detach();
    expect(hud.attached).toBe(false);
  });

  it('throws if the HUD is already bound', () => {
    const hud = createHud();
    const api = makeApi();
    attachHud(api, hud);
    expect(() => attachHud(api, hud)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/hud/src/attach.test.ts`
Expected: FAIL — `attachHud` doesn't exist.

- [ ] **Step 3: Implement attachHud**

```ts
// packages/hud/src/attach.ts
import type { Hud } from './hud';
import type { CanvasExtensionApi } from '../../../src/canvas/canvasExtension';
import type { RenderLayer } from '../../../src/core/layers/render';
import type { DrawCommand } from '../../../src/renderer';
import { DEFAULT_FONT_FAMILY, registerDefaultFont } from './fonts/registerDefaultFont';

export function attachHud(api: CanvasExtensionApi, hud: Hud): () => void {
  if (hud.attached) {
    throw new Error('weasel-hud: this HUD is already attached to a canvas.');
  }

  // Kick off default-font registration; widgets that draw text before this
  // resolves render via the renderer's existing fallback (warn + skip).
  registerDefaultFont().then(() => api.requestRedraw()).catch(err => {
    console.warn('weasel-hud: failed to register default font', err);
  });

  const layer: RenderLayer<unknown> = {
    id: 'weasel-hud',
    label: 'HUD',
    space: 'screen',
    draw: (_data, _view, dims): DrawCommand[] => {
      const ctx = { dims, defaultFont: DEFAULT_FONT_FAMILY };
      const out: DrawCommand[] = [];
      for (const w of hud.widgets()) {
        if (w.hidden) continue;
        const cmds = w.draw(ctx);
        for (const c of cmds) out.push(c);
      }
      return out;
    },
  };
  const detachLayer = api.registerLayer(layer);

  // Hover state — tracked at HUD level so we can fire enter/leave once per crossing.
  let hovered: ReturnType<typeof hud.widgets>[number] | null = null;
  let captured: ReturnType<typeof hud.widgets>[number] | null = null;

  const hitTopmost = (x: number, y: number) => {
    const list = hud.widgets();
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      if (!w.hidden && w.hitTest(x, y)) return w;
    }
    return null;
  };

  const onWindowMove = (e: PointerEvent) => {
    if (captured) {
      const [x, y] = clientToCanvas(e);
      captured.onPointer({ type: 'move', x, y, native: e });
    }
  };
  const onWindowUp = (e: PointerEvent) => {
    if (captured) {
      const [x, y] = clientToCanvas(e);
      captured.onPointer({ type: 'up', x, y, native: e });
      captured = null;
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowCancel);
    }
  };
  const onWindowCancel = (e: PointerEvent) => {
    if (captured) {
      captured.onPointer({ type: 'cancel', native: e });
      captured = null;
      window.removeEventListener('pointermove', onWindowMove);
      window.removeEventListener('pointerup', onWindowUp);
      window.removeEventListener('pointercancel', onWindowCancel);
    }
  };

  // The interceptor needs canvas-relative coords. The native PointerEvent's
  // target is the canvas; clientToCanvas reads its bounding rect.
  const clientToCanvas = (e: PointerEvent): [number, number] => {
    const rect = (e.target as Element).getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top];
  };

  const detachInterceptor = api.installPointerInterceptor((evt) => {
    if (evt.type !== 'pointerdown') return 'pass';
    const [x, y] = clientToCanvas(evt);
    const hit = hitTopmost(x, y);
    if (!hit) return 'pass';
    const claim = hit.onPointer({ type: 'down', x, y, native: evt });
    if (claim === 'claim') {
      captured = hit;
      window.addEventListener('pointermove', onWindowMove);
      window.addEventListener('pointerup', onWindowUp);
      window.addEventListener('pointercancel', onWindowCancel);
    }
    return claim;
  });

  // NOTE: hover tracking via pointermove on the canvas (not the window)
  // requires another extension hook; v1 fires hover only via window-level
  // captures (i.e. only while a widget is captured). True hover-state for
  // non-captured pointermoves is a v1.1 follow-up. (See open question:
  // whether to extend installPointerInterceptor to all pointer events or
  // add installPointerListener.)
  void hovered;   // silence unused — wired up in v1.1

  hud.bind(api as never);   // hud's host shape is a subset of CanvasExtensionApi

  return () => {
    detachLayer();
    detachInterceptor();
    hud.unbind();
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/hud/src/attach.test.ts`
Expected: PASS.

- [ ] **Step 5: Add hud → host coercion fix**

`hud.bind` expects `HudHost`, but we passed `CanvasExtensionApi` directly via cast. Tighten by making `Hud` accept `CanvasExtensionApi` or by writing a thin adapter. Replace the line `hud.bind(api as never)` with a real adapter:

```ts
hud.bind({
  requestRedraw: api.requestRedraw,
  registerLayer: api.registerLayer,
  installPointerInterceptor: api.installPointerInterceptor,
});
```

(`HudHost` and `CanvasExtensionApi` are structurally identical today — this assignment is type-safe without a cast.)

- [ ] **Step 6: Commit**

```bash
git add packages/hud/src/attach.ts packages/hud/src/attach.test.ts
git commit -m "feat(weasel-hud): attachHud wiring layer + interceptor + default font"
```

---

### Task B5: write the public barrel

**Files:**
- Modify: `packages/hud/src/index.ts`

- [ ] **Step 1: Replace the placeholder barrel**

```ts
// packages/hud/src/index.ts
export { createHud, type Hud } from './hud';
export { attachHud } from './attach';
export type {
  Widget,
  WidgetBounds,
  HudDrawCtx,
  HudPointerEvent,
  PointerClaim,
} from './widget';
export type { HudHost, PointerInterceptor } from './host';
export { DEFAULT_FONT_FAMILY, registerDefaultFont } from './fonts/registerDefaultFont';
```

- [ ] **Step 2: Typecheck and commit**

```bash
pnpm exec tsc --noEmit
git add packages/hud/src/index.ts
git commit -m "feat(weasel-hud): public barrel"
```

---

## Stage C — Widgets, React, integration

### Task C1: rect widget

**Files:**
- Create: `packages/hud/src/widgets/rect.ts`
- Create: `packages/hud/src/widgets/rect.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// packages/hud/src/widgets/rect.test.ts
import { describe, it, expect } from 'vitest';
import { createRect } from './rect';

describe('rect widget', () => {
  it('emits a path DrawCommand for its bounds', () => {
    const r = createRect({ id: 'r1', x: 10, y: 20, w: 30, h: 40, fill: '#abcdef' });
    const cmds = r.draw({ dims: { width: 100, height: 100 }, defaultFont: 'x' });
    expect(cmds).toHaveLength(1);
    const cmd = cmds[0];
    expect(cmd.kind).toBe('path');
    expect((cmd as { fill?: { color: string } }).fill?.color).toBe('#abcdef');
  });

  it('hitTest is true inside the rect, false outside', () => {
    const r = createRect({ id: 'r1', x: 10, y: 10, w: 20, h: 20, fill: '#000' });
    expect(r.hitTest(15, 15)).toBe(true);
    expect(r.hitTest(0, 0)).toBe(false);
    expect(r.hitTest(30, 30)).toBe(false);   // exclusive on far edge
  });

  it('hidden rect never hits', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 50, h: 50, fill: '#000' });
    r.setHidden(true);
    expect(r.hitTest(10, 10)).toBe(false);
  });

  it('setBounds mutates and is reflected in subsequent draws', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#fff' });
    r.setBounds({ x: 5, y: 5, w: 20, h: 20 });
    expect(r.bounds).toEqual({ x: 5, y: 5, w: 20, h: 20 });
  });

  it('onPointer always returns pass (rect is not interactive in v1)', () => {
    const r = createRect({ id: 'r1', x: 0, y: 0, w: 10, h: 10, fill: '#fff' });
    expect(r.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent })).toBe('pass');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/hud/src/widgets/rect.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement rect**

```ts
// packages/hud/src/widgets/rect.ts
import type { Widget, HudDrawCtx, HudPointerEvent, PointerClaim, WidgetBounds } from '../widget';
import type { DrawCommand, PathDrawCommand } from '../../../../src/renderer';
import { PATH_M, PATH_L, PATH_Z } from '../../../../src/features/paths/types';

export interface RectOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  fill: string;
  /** Called whenever a setter mutates state. The Hud's `rect()` factory
   *  injects this so mutations trigger `requestRedraw`. Direct callers of
   *  `createRect` may set it themselves or omit it (no auto-redraw). */
  onChange?: () => void;
}

export interface RectWidget extends Widget {
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  setFill(color: string): void;
  dispose(): void;
}

export function createRect(opts: RectOptions): RectWidget {
  if (opts.w <= 0 || opts.h <= 0) {
    throw new Error(`createRect: bounds must have positive w/h (got ${opts.w}x${opts.h})`);
  }
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
  let hidden = false;
  let fill = opts.fill;

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { hidden = h; opts.onChange?.(); },
    setFill(c) { fill = c; opts.onChange?.(); },
    draw(_ctx: HudDrawCtx): DrawCommand[] {
      const { x, y, w, h } = bounds;
      const cmd: PathDrawCommand = {
        kind: 'path',
        path: { commands: [PATH_M, x, y, PATH_L, x + w, y, PATH_L, x + w, y + h, PATH_L, x, y + h, PATH_Z] },
        fill: { fill: 'solid', color: fill },
      };
      return [cmd];
    },
    hitTest(x, y) {
      if (hidden) return false;
      return x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
    },
    onPointer(_evt: HudPointerEvent): PointerClaim { return 'pass'; },
    dispose() { /* nothing to clean up */ },
  };
}
```

- [ ] **Step 4: Verify the path constants and Path type shape**

Run: `grep -n "PATH_M\|PATH_L\|PATH_Z" src/features/paths/types.ts | head`
Expected: confirms the constant names and that `commands` is the field name.

If the constants or shape differ, adjust the rect implementation to match. (The `Path` type lives in `src/features/paths/types.ts`.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/hud/src/widgets/rect.test.ts`
Expected: PASS.

- [ ] **Step 6: Add rect to barrel and Hud factory**

In `packages/hud/src/hud.ts`, extend the returned object:

```ts
import { createRect, type RectOptions, type RectWidget } from './widgets/rect';

// ... inside createHud's return object, add:
rect(opts: RectOptions): RectWidget {
  // Inject onChange so widget setters auto-trigger requestRedraw.
  const w = createRect({ ...opts, onChange: () => requestRedraw() });
  this.add(w);
  return w;
},
```

(Update the `Hud` interface to declare `rect(opts: RectOptions): RectWidget`.)

In `packages/hud/src/index.ts`, export the rect types:

```ts
export type { RectOptions, RectWidget } from './widgets/rect';
```

- [ ] **Step 7: Add Hud-factory test**

In `packages/hud/src/hud.test.ts` add:

```ts
it('rect() factory creates widget and adds it to the list', () => {
  const hud = createHud();
  hud.bind(makeHost());
  const r = hud.rect({ id: 'r', x: 0, y: 0, w: 10, h: 10, fill: '#000' });
  expect(hud.widgets()).toEqual([r]);
});
```

Run: `pnpm exec vitest run packages/hud/src/`
Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/hud/src/widgets/rect.ts packages/hud/src/widgets/rect.test.ts packages/hud/src/hud.ts packages/hud/src/hud.test.ts packages/hud/src/index.ts
git commit -m "feat(weasel-hud): rect widget"
```

---

### Task C2: text and image widgets

**Files:**
- Create: `packages/hud/src/widgets/text.ts` + test
- Create: `packages/hud/src/widgets/image.ts` + test

- [ ] **Step 1: Write text widget + test**

```ts
// packages/hud/src/widgets/text.ts
import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent, PointerClaim } from '../widget';
import type { DrawCommand, TextDrawCommand } from '../../../../src/renderer';

export interface TextOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize: number;
  color: string;
  /** Optional; falls back to the HUD default font from HudDrawCtx. */
  fontFamily?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
}

export interface TextWidget extends Widget {
  setText(text: string): void;
  setHidden(hidden: boolean): void;
  setBounds(b: WidgetBounds): void;
  dispose(): void;
}

export function createText(opts: TextOptions): TextWidget {
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: 0, h: opts.fontSize };
  let text = opts.text;
  let hidden = false;
  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { hidden = h; opts.onChange?.(); },
    setText(t) { text = t; opts.onChange?.(); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const cmd: TextDrawCommand = {
        kind: 'text',
        x: bounds.x,
        y: bounds.y,
        text,
        style: {
          fontFamily: opts.fontFamily ?? ctx.defaultFont,
          fontSize: opts.fontSize,
          color: opts.color,
        },
      };
      return [cmd];
    },
    hitTest() { return false; },   // text is passive in v1
    onPointer(_e: HudPointerEvent): PointerClaim { return 'pass'; },
    dispose() {},
  };
}
```

```ts
// packages/hud/src/widgets/text.test.ts
import { describe, it, expect } from 'vitest';
import { createText } from './text';

describe('text widget', () => {
  it('emits a TextDrawCommand using the supplied style', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'hi', fontSize: 14, color: '#000', fontFamily: 'Foo' });
    const cmds = t.draw({ dims: { width: 100, height: 100 }, defaultFont: 'Default' });
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toMatchObject({ kind: 'text', text: 'hi', x: 0, y: 10 });
    expect((cmds[0] as { style: { fontFamily: string } }).style.fontFamily).toBe('Foo');
  });

  it('falls back to ctx.defaultFont when no fontFamily is given', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'hi', fontSize: 14, color: '#000' });
    const cmds = t.draw({ dims: { width: 100, height: 100 }, defaultFont: 'Default' });
    expect((cmds[0] as { style: { fontFamily: string } }).style.fontFamily).toBe('Default');
  });

  it('setText mutates and the next draw reflects it', () => {
    const t = createText({ id: 't', x: 0, y: 10, text: 'a', fontSize: 14, color: '#000' });
    t.setText('b');
    const cmds = t.draw({ dims: { width: 100, height: 100 }, defaultFont: 'D' });
    expect((cmds[0] as { text: string }).text).toBe('b');
  });
});
```

- [ ] **Step 2: Write image widget + test**

```ts
// packages/hud/src/widgets/image.ts
import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent, PointerClaim } from '../widget';
import type { DrawCommand, ImageDrawCommand } from '../../../../src/renderer';

export interface ImageOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  image: ImageBitmap;
  opacity?: number;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
}

export interface ImageWidget extends Widget {
  setImage(image: ImageBitmap): void;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  dispose(): void;
}

export function createImage(opts: ImageOptions): ImageWidget {
  if (opts.w <= 0 || opts.h <= 0) {
    throw new Error(`createImage: bounds must have positive w/h (got ${opts.w}x${opts.h})`);
  }
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
  let image = opts.image;
  let hidden = false;
  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { hidden = h; opts.onChange?.(); },
    setImage(img) { image = img; opts.onChange?.(); },
    draw(_ctx: HudDrawCtx): DrawCommand[] {
      const cmd: ImageDrawCommand = {
        kind: 'image', image,
        x: bounds.x, y: bounds.y, w: bounds.w, h: bounds.h,
        opacity: opts.opacity,
      };
      return [cmd];
    },
    hitTest(x, y) {
      if (hidden) return false;
      return x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;
    },
    onPointer(_e: HudPointerEvent): PointerClaim { return 'pass'; },
    dispose() {},
  };
}
```

```ts
// packages/hud/src/widgets/image.test.ts
import { describe, it, expect } from 'vitest';
import { createImage } from './image';

describe('image widget', () => {
  it('emits an ImageDrawCommand for its bounds', () => {
    const fakeImage = {} as ImageBitmap;
    const i = createImage({ id: 'i', x: 1, y: 2, w: 3, h: 4, image: fakeImage });
    const cmds = i.draw({ dims: { width: 100, height: 100 }, defaultFont: 'd' });
    expect(cmds[0]).toMatchObject({ kind: 'image', x: 1, y: 2, w: 3, h: 4 });
  });

  it('throws on zero/negative bounds', () => {
    const fakeImage = {} as ImageBitmap;
    expect(() => createImage({ id: 'i', x: 0, y: 0, w: 0, h: 10, image: fakeImage })).toThrow();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `pnpm exec vitest run packages/hud/src/widgets/`
Expected: rect, text, image all PASS.

- [ ] **Step 4: Add factories to Hud + barrel**

In `hud.ts`, mirror the rect pattern (inject `onChange`):

```ts
text(opts: TextOptions): TextWidget {
  const w = createText({ ...opts, onChange: () => requestRedraw() });
  this.add(w);
  return w;
},
image(opts: ImageOptions): ImageWidget {
  const w = createImage({ ...opts, onChange: () => requestRedraw() });
  this.add(w);
  return w;
},
```

In `index.ts`, export the new types: `TextOptions`, `TextWidget`, `ImageOptions`, `ImageWidget`.

- [ ] **Step 5: Commit**

```bash
git add packages/hud/
git commit -m "feat(weasel-hud): text and image widgets"
```

---

### Task C3: label widget (text with default-font ergonomics)

**Files:**
- Create: `packages/hud/src/widgets/label.ts` + test

A `label` is a text widget with sensible defaults — explicit factory for clarity.

- [ ] **Step 1: Write label**

```ts
// packages/hud/src/widgets/label.ts
import { createText, type TextWidget } from './text';

export interface LabelOptions {
  id: string;
  x: number; y: number;
  text: string;
  fontSize?: number;
  color?: string;
  onChange?: () => void;
}

export type LabelWidget = TextWidget;

export function createLabel(opts: LabelOptions): LabelWidget {
  return createText({
    id: opts.id,
    x: opts.x,
    y: opts.y,
    text: opts.text,
    fontSize: opts.fontSize ?? 13,
    color: opts.color ?? '#1a1a1a',
    onChange: opts.onChange,
    // fontFamily intentionally undefined → ctx.defaultFont
  });
}
```

- [ ] **Step 2: Write test**

```ts
// packages/hud/src/widgets/label.test.ts
import { describe, it, expect } from 'vitest';
import { createLabel } from './label';

describe('label widget', () => {
  it('uses sensible defaults for fontSize and color', () => {
    const l = createLabel({ id: 'l', x: 0, y: 0, text: 'x' });
    const cmds = l.draw({ dims: { width: 100, height: 100 }, defaultFont: 'Default' });
    const style = (cmds[0] as { style: { fontSize: number; color: string; fontFamily: string } }).style;
    expect(style.fontSize).toBe(13);
    expect(style.color).toBe('#1a1a1a');
    expect(style.fontFamily).toBe('Default');
  });
});
```

- [ ] **Step 3: Add to Hud + barrel + run tests + commit**

```ts
// in hud.ts
import { createLabel, type LabelOptions, type LabelWidget } from './widgets/label';

label(opts: LabelOptions): LabelWidget {
  const w = createLabel({ ...opts, onChange: () => requestRedraw() });
  this.add(w);
  return w;
},
```

```bash
pnpm exec vitest run packages/hud/src/
git add packages/hud/
git commit -m "feat(weasel-hud): label widget"
```

---

### Task C4: button widget (interactive — hit-test, hover, press, events)

**Files:**
- Create: `packages/hud/src/widgets/button.ts` + test

- [ ] **Step 1: Write failing tests**

```ts
// packages/hud/src/widgets/button.test.ts
import { describe, it, expect, vi } from 'vitest';
import { createButton } from './button';

const ctx = { dims: { width: 100, height: 100 }, defaultFont: 'D' };

describe('button widget', () => {
  it('draws a body rect and a label', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'Save' });
    const cmds = b.draw(ctx);
    expect(cmds.length).toBeGreaterThanOrEqual(2);   // body + text
    expect(cmds.some(c => c.kind === 'path')).toBe(true);
    expect(cmds.some(c => c.kind === 'text')).toBe(true);
  });

  it('hitTest is bounds-rectangular', () => {
    const b = createButton({ id: 'b', x: 10, y: 10, w: 80, h: 24, label: 'x' });
    expect(b.hitTest(20, 20)).toBe(true);
    expect(b.hitTest(0, 0)).toBe(false);
  });

  it('press event fires on down then up inside bounds', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    expect(b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent })).toBe('claim');
    expect(b.onPointer({ type: 'up', x: 5, y: 5, native: {} as PointerEvent })).toBe('pass');
    expect(press).toHaveBeenCalledTimes(1);
  });

  it('onChange fires when state mutates (used by Hud to trigger redraws)', () => {
    const onChange = vi.fn();
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x', onChange });
    onChange.mockClear();
    b.setLabel('y');
    expect(onChange).toHaveBeenCalled();
  });

  it('press event does NOT fire on down then up-outside', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent });
    b.onPointer({ type: 'up', x: 200, y: 200, native: {} as PointerEvent });
    expect(press).not.toHaveBeenCalled();
  });

  it('cancel rolls back press state without firing press', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);

    b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent });
    b.onPointer({ type: 'cancel', native: {} as PointerEvent });
    expect(press).not.toHaveBeenCalled();
  });

  it('setLabel mutates the rendered text', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'a' });
    b.setLabel('b');
    const cmds = b.draw(ctx);
    const txt = cmds.find(c => c.kind === 'text') as { text: string };
    expect(txt.text).toBe('b');
  });

  it('off() removes a handler', () => {
    const b = createButton({ id: 'b', x: 0, y: 0, w: 80, h: 24, label: 'x' });
    const press = vi.fn();
    b.on('press', press);
    b.off('press', press);
    b.onPointer({ type: 'down', x: 5, y: 5, native: {} as PointerEvent });
    b.onPointer({ type: 'up', x: 5, y: 5, native: {} as PointerEvent });
    expect(press).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run packages/hud/src/widgets/button.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement button**

```ts
// packages/hud/src/widgets/button.ts
import type { Widget, WidgetBounds, HudDrawCtx, HudPointerEvent, PointerClaim } from '../widget';
import type { DrawCommand, PathDrawCommand, TextDrawCommand } from '../../../../src/renderer';
import { PATH_M, PATH_L, PATH_Z } from '../../../../src/features/paths/types';

export type ButtonEvent = 'press' | 'hover' | 'leave';
export type ButtonHandler = () => void;

export interface ButtonOptions {
  id: string;
  x: number; y: number; w: number; h: number;
  label: string;
  fill?: string;
  pressedFill?: string;
  hoverFill?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  /** Injected by Hud factories to trigger redraw on mutation. */
  onChange?: () => void;
}

export interface ButtonWidget extends Widget {
  setLabel(label: string): void;
  setBounds(b: WidgetBounds): void;
  setHidden(hidden: boolean): void;
  on(event: ButtonEvent, handler: ButtonHandler): void;
  off(event: ButtonEvent, handler: ButtonHandler): void;
  dispose(): void;
}

export function createButton(opts: ButtonOptions): ButtonWidget {
  if (opts.w <= 0 || opts.h <= 0) {
    throw new Error(`createButton: bounds must have positive w/h`);
  }
  let bounds: WidgetBounds = { x: opts.x, y: opts.y, w: opts.w, h: opts.h };
  let hidden = false;
  let label = opts.label;
  let pressed = false;
  let hovering = false;
  const fill = opts.fill ?? '#ffffff';
  const pressedFill = opts.pressedFill ?? '#e0e0e0';
  const hoverFill = opts.hoverFill ?? '#f5f5f5';
  const textColor = opts.textColor ?? '#1a1a1a';
  const fontSize = opts.fontSize ?? 13;

  const handlers: Record<ButtonEvent, Set<ButtonHandler>> = {
    press: new Set(), hover: new Set(), leave: new Set(),
  };
  const emit = (e: ButtonEvent) => { for (const h of handlers[e]) h(); };

  const isInside = (x: number, y: number) =>
    x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h;

  return {
    id: opts.id,
    get bounds() { return bounds; },
    get hidden() { return hidden; },
    setBounds(b) { bounds = { ...b }; opts.onChange?.(); },
    setHidden(h) { hidden = h; opts.onChange?.(); },
    setLabel(l) { label = l; opts.onChange?.(); },
    on(event, handler) { handlers[event].add(handler); },
    off(event, handler) { handlers[event].delete(handler); },
    draw(ctx: HudDrawCtx): DrawCommand[] {
      const { x, y, w, h } = bounds;
      const bodyColor = pressed ? pressedFill : hovering ? hoverFill : fill;
      const body: PathDrawCommand = {
        kind: 'path',
        path: { commands: [PATH_M, x, y, PATH_L, x + w, y, PATH_L, x + w, y + h, PATH_L, x, y + h, PATH_Z] },
        fill: { fill: 'solid', color: bodyColor },
      };
      const text: TextDrawCommand = {
        kind: 'text',
        x: x + 8,                    // 8px left padding
        y: y + h / 2 + fontSize / 3, // rough vertical center
        text: label,
        style: { fontFamily: opts.fontFamily ?? ctx.defaultFont, fontSize, color: textColor },
      };
      return [body, text];
    },
    hitTest(x, y) {
      if (hidden) return false;
      return isInside(x, y);
    },
    onPointer(evt: HudPointerEvent): PointerClaim {
      switch (evt.type) {
        case 'down':
          pressed = true;
          opts.onChange?.();
          return 'claim';
        case 'move': {
          // While captured, track whether we're still inside (visual press feedback).
          const next = isInside(evt.x, evt.y);
          if (next !== pressed) { pressed = next; opts.onChange?.(); }
          return 'pass';
        }
        case 'up':
          if (pressed && isInside(evt.x, evt.y)) emit('press');
          if (pressed) { pressed = false; opts.onChange?.(); }
          return 'pass';
        case 'cancel':
          if (pressed) { pressed = false; opts.onChange?.(); }
          return 'pass';
        case 'hovermove':
          if (!hovering) { hovering = true; emit('hover'); opts.onChange?.(); }
          return 'pass';
        case 'hoverleave':
          if (hovering) { hovering = false; emit('leave'); opts.onChange?.(); }
          return 'pass';
      }
    },
    dispose() {
      for (const set of Object.values(handlers)) set.clear();
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run packages/hud/src/widgets/button.test.ts`
Expected: PASS.

- [ ] **Step 5: Add to Hud + barrel**

```ts
// in hud.ts
import { createButton, type ButtonOptions, type ButtonWidget } from './widgets/button';

button(opts: ButtonOptions): ButtonWidget {
  const w = createButton({ ...opts, onChange: () => requestRedraw() });
  this.add(w);
  return w;
},
```

In `index.ts`:

```ts
export type { ButtonOptions, ButtonWidget, ButtonEvent, ButtonHandler } from './widgets/button';
```

- [ ] **Step 6: Run full HUD suite**

Run: `pnpm exec vitest run packages/hud/`
Expected: all PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/hud/
git commit -m "feat(weasel-hud): button widget with press/hover/leave events"
```

---

### Task C5: React subpath (useHud)

**Files:**
- Create: `packages/hud/src/react/index.ts`
- Create: `packages/hud/src/react/useHud.ts`
- Create: `packages/hud/src/react/useHud.test.tsx`
- Modify: `packages/hud/package.json` — add `./react` export

- [ ] **Step 1: Add React subpath to package.json**

In `packages/hud/package.json`, replace the `exports` block:

```json
"exports": {
  ".": {
    "import": "./src/index.ts",
    "types": "./src/index.ts"
  },
  "./react": {
    "import": "./src/react/index.ts",
    "types": "./src/react/index.ts"
  },
  "./package.json": "./package.json"
},
"peerDependencies": {
  "react": ">=18"
}
```

- [ ] **Step 2: Write the failing test**

```tsx
// packages/hud/src/react/useHud.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHud } from './useHud';
import type { CanvasExtensionApi } from '../../../../src/canvas/canvasExtension';

function makeApiRef() {
  const api: CanvasExtensionApi = {
    requestRedraw: vi.fn(),
    registerLayer: vi.fn(() => () => {}),
    installPointerInterceptor: vi.fn(() => () => {}),
  };
  return { current: api };
}

describe('useHud', () => {
  it('attaches on mount and detaches on unmount', () => {
    const ref = makeApiRef();
    const { result, unmount } = renderHook(() => useHud(ref));
    expect(result.current.attached).toBe(true);
    expect(ref.current.registerLayer).toHaveBeenCalledTimes(1);

    unmount();
    expect(result.current.attached).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm exec vitest run packages/hud/src/react/useHud.test.tsx`
Expected: FAIL.

- [ ] **Step 4: Implement useHud**

```ts
// packages/hud/src/react/useHud.ts
import { useEffect, useState } from 'react';
import { createHud, type Hud } from '../hud';
import { attachHud } from '../attach';
import type { CanvasExtensionApi } from '../../../../src/canvas/canvasExtension';

export function useHud(canvasRef: { current: CanvasExtensionApi | null }): Hud {
  const [hud] = useState(() => createHud());

  useEffect(() => {
    const api = canvasRef.current;
    if (!api) return;
    const detach = attachHud(api, hud);
    return detach;
    // canvasRef.current changing during the lifetime of a component is
    // unusual for canvas refs; treat as effectively-stable for v1.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hud]);

  return hud;
}
```

```ts
// packages/hud/src/react/index.ts
export { useHud } from './useHud';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm exec vitest run packages/hud/src/react/useHud.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/hud/
git commit -m "feat(weasel-hud): React subpath with useHud hook"
```

---

### Task C6: end-to-end integration test

**Files:**
- Create: `packages/hud/src/integration.test.tsx`

Proves the full input-claim contract: real `<Canvas>`, real HUD, real button, simulated pointerdown.

- [ ] **Step 1: Write the test**

```tsx
// packages/hud/src/integration.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { Canvas } from '../../../src/canvas/Canvas';
import { useHud } from './react';
import type { CanvasExtensionApi } from '../../../src/canvas/canvasExtension';

function HudHarness({ onMount }: { onMount: (hud: ReturnType<typeof useHud>) => void }) {
  const ref = React.useRef<CanvasExtensionApi>(null);
  const hud = useHud(ref);
  React.useEffect(() => { onMount(hud); }, [hud, onMount]);
  return (
    <Canvas
      ref={ref}
      width={200} height={200}
      adapter={{} as never}        // mocked; this test doesn't exercise scene
      items={[]} setItems={() => {}}
      layers={{}}
    />
  );
}

describe('weasel-hud integration', () => {
  it('button click claims the event before tools see it', async () => {
    const press = vi.fn();
    const dispatcherSpy = vi.fn();

    let createdHud: ReturnType<typeof useHud> | null = null;
    const onMount = (hud: ReturnType<typeof useHud>) => { createdHud = hud; };

    const { container } = render(<HudHarness onMount={onMount} />);

    // Wait a microtask for useHud's effect.
    await act(async () => {});

    expect(createdHud).not.toBeNull();
    const btn = createdHud!.button({ id: 'save', x: 10, y: 10, w: 60, h: 24, label: 'Save' });
    btn.on('press', press);

    const canvas = container.querySelector('canvas')!;
    fireEvent.pointerDown(canvas, { clientX: 30, clientY: 20 });
    fireEvent.pointerUp(canvas, { clientX: 30, clientY: 20 });

    expect(press).toHaveBeenCalledTimes(1);
    expect(dispatcherSpy).not.toHaveBeenCalled();
  });

  it('click outside any widget falls through to canvas', async () => {
    let createdHud: ReturnType<typeof useHud> | null = null;
    const { container } = render(
      <HudHarness onMount={(h) => { createdHud = h; }} />
    );
    await act(async () => {});
    createdHud!.button({ id: 'b', x: 10, y: 10, w: 60, h: 24, label: 'x' });

    const canvas = container.querySelector('canvas')!;
    // Click far from the button — should NOT claim.
    const press = vi.fn();
    createdHud!.widgets()[0] && (createdHud!.widgets()[0] as never);   // sanity
    fireEvent.pointerDown(canvas, { clientX: 150, clientY: 150 });
    expect(press).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the integration test**

Run: `pnpm exec vitest run packages/hud/src/integration.test.tsx`
Expected: PASS.

If it fails, the most likely reasons are:
- The Canvas in jsdom doesn't get a real `getBoundingClientRect` for the canvas element. Fix: jsdom returns `{ left: 0, top: 0, width, height, ... }` by default — clientX/clientY should work as canvas-local coords, which is what the button's `hitTest` expects.
- The button hit-test fails because `clientToCanvas` reads `e.target.getBoundingClientRect`. Verify by logging the computed `[x, y]`.

- [ ] **Step 3: Commit**

```bash
git add packages/hud/src/integration.test.tsx
git commit -m "test(weasel-hud): end-to-end input-claim integration"
```

---

### Task C7: demo

**Files:**
- Create: `demo/demos/HudDemo.tsx`
- Modify: `demo/demos/index.ts` (or whatever the registry file is — discover via grep)

- [ ] **Step 1: Discover the demo registry**

Run: `grep -rn "ZoomDemo\|EasingsDemo" demo/ | grep -v ".tsx:" | head`
Expected: identifies the registry file. (Likely `demo/App.tsx` or `demo/demos/index.ts`.)

- [ ] **Step 2: Write a small HudDemo**

```tsx
// demo/demos/HudDemo.tsx
import { useRef, useState } from 'react';
import { SceneCanvas } from '@weasel-js/core';
import { useHud } from '@weasel-js/hud/react';
import type { CanvasExtensionApi } from '../../src/canvas/canvasExtension';
import { useScene } from '@weasel-js/core';

export function HudDemo() {
  const ref = useRef<CanvasExtensionApi>(null);
  const hud = useHud(ref);
  const [count, setCount] = useState(0);
  const scene = useScene<{ kind: 'rect' }>({ root: { id: 'root', children: [] } });

  // Build initial widgets once. The button mutates count via setLabel after we
  // wire its handler; the count state lives in React, the visual state in the
  // HUD widget.
  const btnRef = useRef<ReturnType<typeof hud.button> | null>(null);
  if (!btnRef.current && hud.attached) {
    const btn = hud.button({ id: 'inc', x: 12, y: 12, w: 100, h: 28, label: 'Click me' });
    btn.on('press', () => setCount(c => c + 1));
    btnRef.current = btn;
  }
  // Sync the label on count changes
  if (btnRef.current) btnRef.current.setLabel(`Clicks: ${count}`);

  return (
    <SceneCanvas
      ref={ref as never}
      scene={scene}
      width={600} height={400}
      background="#f0f0f0"
    />
  );
}
```

(Note: the imperative `if (!btnRef.current && hud.attached)` pattern is unusual in React. For v1 demo purposes it's fine; a follow-up could provide a `<HudWidget>` declarative component in the React subpath.)

- [ ] **Step 3: Register the demo**

Add `HudDemo` to the registry following the pattern of existing demos. Confirm the dev server picks it up:

```bash
pnpm dev
```

Open the demo page in a browser, navigate to HudDemo, click the button — count should increment and the label should reflect it.

- [ ] **Step 4: Test it manually in the browser**

(This is a UI/frontend task — per project conventions, verify in the browser before claiming done. Click the button. Confirm: visual press feedback (the button darkens on hover/press), the label text updates with the count, no console errors.)

- [ ] **Step 5: Commit**

```bash
git add demo/demos/HudDemo.tsx demo/demos/index.ts
git commit -m "demo(weasel-hud): HudDemo with a click counter"
```

---

## Verification gate

Before declaring v1 done, run the full prepublishOnly equivalent (per the project's CI gate, also captured in memory):

- [ ] **Step 1: Typecheck**

Run: `pnpm exec tsc --noEmit`
Expected: clean.

- [ ] **Step 2: Tests**

Run: `pnpm exec vitest run`
Expected: all passing (modulo the pre-existing `GradientPlaygroundDemo.test.tsx` failure).

- [ ] **Step 3: Build**

Run: `pnpm exec tsup`
Expected: `Build success`.

- [ ] **Step 4: Final commit / push**

If everything's clean, the implementation is complete. Decision on push is left to the user.

---

## Notes on follow-ups (out of scope for v1)

The spec calls these out as deliberate v1.5+ work:

1. **Theme system.** Mentioned in the spec as "immediately next." A central `HudTheme` object keyed by widget kind, with widgets reading from it via `HudDrawCtx`. Each widget's options become partial overrides. ~1 day's work after v1 lands.
2. **World-space widgets.** Same widget protocol; the layer registers as `space: 'world'` and widgets render with a transform applied. The hit-test path needs camera-aware coord conversion.
3. **Container widgets / nesting.** A `Panel` widget that owns children and proxies hit-test/draw. Protocol stays the same.
4. **Hover state for non-captured pointermoves.** Requires extending `installPointerInterceptor` to all pointer event types or adding `installPointerListener`. Currently the HUD only sees pointermove during a captured drag.
5. **Immediate-mode helper.** A thin shim over the retained core that lets consumers rebuild widgets per frame. Helpful for debug overlays.
6. **z-order controls.** `bringToFront` / `sendToBack` on widgets.
7. **Pixel-diff visual regression.**

Don't bundle these into the v1 plan. Each warrants its own brainstorm pass.
