# Frame-Loop Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `<Canvas>` paint from its own `requestAnimationFrame` loop instead of from a React render, and give the view an imperative path (`setView` / `getView` / `subscribeView`) so a 60 Hz camera costs zero React renders.

**Architecture:** The paint body does not move — only its trigger does. `requestRedraw` sets `dirtyRef.current = true` and schedules a frame; the loop paints when dirty. React renders write their inputs (layer stack, dims, debug config) into a ref and mark dirty on the way past. `view` moves from `useState` into a ref with a subscriber set, exposed on `CanvasExtensionApi`; `SceneCanvas` stops holding view in state and routes its `view.set` dep through the handle. Consumers who pass a `view` prop stay controlled and keep exactly today's behavior.

**Tech Stack:** TypeScript, React 19, WebGL2 (`WeaselRenderer`), vitest + @testing-library/react (project `kit`), Playwright (visual baselines).

**Design source:** `docs/superpowers/specs/2026-08-24-frame-loop-decoupling-design.md`, Part 1. Part 2 (ephemeral pose overrides) is a separate plan — `docs/superpowers/plans/2026-08-24-ephemeral-pose-overrides.md` — and the two are independent.

---

## File Structure

**Modified:**

- `packages/core/src/canvas/Canvas.tsx` — the whole change lands here. Today: `requestRedraw` is `setRedrawNonce(n => n + 1)` (`:779-780`), the paint is a `useEffect` keyed on nine deps (`:1225-1285`), and the view is `useState` (`:845-846`). After: a `paint()` callback reading refs, a rAF scheduler, a view ref with subscribers, and three new handle members.
- `packages/core/src/canvas/canvasExtension.ts` — `CanvasExtensionApi` gains `getView` / `setView` / `subscribeView` / `getPaintedVersion`.
- `packages/core/src/canvas/SceneCanvas.tsx` — drops `internalView` `useState` (`:961-963`); the mirror ref stays and is fed by `subscribeView`.
- `packages/core/src/tools/builtin/pinchZoom/usePinchZoomTool.ts` — takes a view *getter* instead of a view value, because Canvas no longer re-renders to refresh it.
- `packages/core/src/features/text/useSceneTextEdit.ts` — the `view` option accepts a thunk, so the overlay tracks a ref-driven camera.
- `packages/core/src/core/scene/useScene.ts` — adds the non-subscribing accessor.
- `apps/site/demos/SceneScrollerDemo.tsx` — the reference consumer: camera through `setView`.

**Created:**

- `packages/core/src/canvas/Canvas.frameLoop.test.tsx` — the loop's own contract: coalescing, no-render-per-paint, lifecycle.
- `packages/core/src/canvas/Canvas.imperativeView.test.tsx` — `setView` / `getView` / `subscribeView`, controlled-mode refusal.

**Deliberately not created:** a dev-mode warning for scene-derived DOM inside `startTransition`. The spec asks for one "if that is detectable" — React exposes no way to ask whether the current render is a transition, so this ships as a documented rule (Task 11) rather than a check that would give false confidence.

---

### Task 1: Paint on a frame loop instead of a React effect

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx:779-790` (redraw), `:1210-1223` (layer memo), `:1225-1285` (paint effect)
- Test: `packages/core/src/canvas/Canvas.frameLoop.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/Canvas.frameLoop.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { useRef } from 'react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';
import type { DebugSink } from './debug/sink';

beforeAll(() => { makeGLRecorder(); });
afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function Host({ apiRef }: { apiRef: React.MutableRefObject<CanvasExtensionApi | null> }) {
  const sinkRef = useRef<DebugSink | null>(null);
  return (
    <Canvas
      ref={apiRef as never}
      width={100}
      height={80}
      layers={[]}
      debug
      debugSinkRef={sinkRef}
    />
  );
}

describe('Canvas frame loop', () => {
  it('coalesces many requestRedraw calls in one tick into a single paint', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(<Host apiRef={apiRef} />);
    await frame();

    const painted = vi.fn();
    apiRef.current!.subscribeFrame!(painted);

    act(() => {
      apiRef.current!.requestRedraw();
      apiRef.current!.requestRedraw();
      apiRef.current!.requestRedraw();
    });
    await frame();
    await frame();

    expect(painted).toHaveBeenCalledTimes(1);
  });

  it('does not re-render the host to paint', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    let renders = 0;
    function Counting() {
      renders++;
      return <Host apiRef={apiRef} />;
    }
    render(<Counting />);
    await frame();
    const before = renders;

    act(() => { apiRef.current!.requestRedraw(); });
    await frame();
    await frame();

    expect(renders).toBe(before);
  });
});
```

`subscribeFrame` is the observable the loop needs to be testable at all — a paint that costs no render is otherwise invisible to a test. It is added to the handle in Step 3 and is public surface: chrome that must run after pixels land (a loupe readback, a frame counter) has the same need.

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.frameLoop.test.tsx`
Expected: FAIL — `apiRef.current.subscribeFrame is not a function`.

- [ ] **Step 3: Add the loop**

In `packages/core/src/canvas/Canvas.tsx`, replace the redraw nonce at `:779-790`:

```tsx
  // The paint is driven by a frame loop, not by React. `requestRedraw` marks
  // the surface dirty; the loop paints once per frame at most, whatever asked.
  const dirtyRef = useRef(true);
  const rafRef = useRef(0);
  const paintRef = useRef<() => void>(() => {});
  const frameSubsRef = useRef<Set<() => void>>(new Set());

  const scheduleFrame = useCallback(() => {
    if (rafRef.current !== 0) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      paintRef.current();
      for (const fn of frameSubsRef.current) fn();
    });
  }, []);

  const requestRedraw = useCallback(() => {
    dirtyRef.current = true;
    scheduleFrame();
  }, [scheduleFrame]);

  const subscribeFrame = useCallback((fn: () => void) => {
    frameSubsRef.current.add(fn);
    return () => { frameSubsRef.current.delete(fn); };
  }, []);

  // Registration of an external layer is rare (a HUD attaching, a loupe
  // mounting) and must re-run the `layersWithDebug` memo, which reads
  // `extrasRef.current`. That one keeps a React state bump; the per-frame
  // path no longer does.
  const [extrasVersion, setExtrasVersion] = useState(0);
  const extrasRef = useRef<Set<RenderLayer<unknown>>>(new Set());
  const registerLayer = useCallback((layer: RenderLayer<unknown>) => {
    extrasRef.current.add(layer);
    setExtrasVersion(n => n + 1);
    return () => {
      extrasRef.current.delete(layer);
      setExtrasVersion(n => n + 1);
    };
  }, []);
```

Delete the `const [redrawNonce, setRedrawNonce] = useState(0);` line and the old `requestRedraw` / `registerLayer` bodies it served.

At `:1210-1223`, swap the memo's `redrawNonce` dep for `extrasVersion` and update the comment:

```tsx
    // extrasVersion drives re-reads of extrasRef when layers are registered/detached;
    // viewRegistryVersion does the same for registered views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, debugSink, resolvedDebugConfig, extrasVersion, viewRegistry, viewRegistryVersion]);
```

- [ ] **Step 4: Move the paint body into a ref-read callback**

Immediately after the `layersWithDebug` memo, add the input mirror:

```tsx
  // Everything the paint reads that a React render owns. Written during
  // render; the loop reads whatever the last commit left behind.
  const paintInputsRef = useRef({
    layers: layersWithDebug, width, height, debugSink,
    dpr: dprProp, layerVisibility, layerOrder,
  });
  paintInputsRef.current = {
    layers: layersWithDebug, width, height, debugSink,
    dpr: dprProp, layerVisibility, layerOrder,
  };
```

Replace the paint `useEffect` at `:1225-1285` with a callback of the same body, reading from the mirror and from `viewRef`:

```tsx
  const paint = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const {
      layers: paintLayers, width: w, height: h, debugSink: sink,
      dpr: dprIn, layerVisibility: vis, layerOrder: order,
    } = paintInputsRef.current;

    // Clear sink at the top of every paint so per-frame records don't leak.
    sink?.beginFrame();
    if (sink) {
      for (let i = 0; i < paintLayers.length; i++) {
        const layer = paintLayers[i];
        if (layer.id === 'debug-overlay') continue;
        sink.recordLayer(layer.id, layer.label, layer.space ?? 'world', i);
      }
    }

    let renderer = glRendererRef.current;
    if (!renderer) {
      const dpr = dprIn ?? (window.devicePixelRatio || 1);
      const gl = c.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
      if (!gl || typeof (gl as Partial<WebGL2RenderingContext>).enable !== 'function') {
        // jsdom or unsupported environment — bail silently.
        return;
      }
      try {
        renderer = new WeaselRenderer({ gl: gl as WebGL2RenderingContext, canvas: c, width: w, height: h, dpr });
      } catch {
        return;
      }
      glRendererRef.current = renderer;
      lastResizeRef.current = { w, h, dpr };
    } else {
      const dpr = dprIn ?? (window.devicePixelRatio || 1);
      const last = lastResizeRef.current;
      if (!last || last.w !== w || last.h !== h || last.dpr !== dpr) {
        renderer.resize({ width: w, height: h, dpr });
        lastResizeRef.current = { w, h, dpr };
      }
    }

    const view = viewRef.current;
    const commands = drawLayers(
      paintLayers,
      helpersForLayersRef.current,
      vis ?? NO_LAYER_VISIBILITY,
      order,
      view,
      { width: w, height: h },
      layerCacheRef.current,
    );
    renderer.render(commands, viewToMat3(view));
  }, []);
  paintRef.current = paint;

  // React-owned inputs changed — the mirror above already holds them, so the
  // commit only has to mark the surface dirty.
  useEffect(() => {
    requestRedraw();
  }, [layersWithDebug, width, height, effectiveView, debugSink, dprProp,
      layerVisibility, layerOrder, requestRedraw]);
```

`paintRef` is what breaks the cycle: `scheduleFrame` is created before `paint` exists, and a stable scheduler is what keeps `requestRedraw` identity-stable for the dozens of consumers that capture it (`packages/hud/src/attach.ts:144`, `useGestureDispatcher.tsx:482`, and the `attachSurface` handle at `Canvas.tsx:1201`).

- [ ] **Step 5: Run the new tests**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.frameLoop.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Run the whole canvas suite for fallout**

Run: `npx vitest run --project=kit packages/core/src/canvas`
Expected: PASS. `Canvas.test.tsx` already pairs `act(...)` with `await waitForFrame()` (`:643-647`), and `Canvas.layerCache.test.tsx:41-48` asserts across a `rerender` with no frame await — that one will need `await frame()` added before its assertions, since a commit no longer paints synchronously. Add the await; do not weaken the assertion.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/canvas/Canvas.tsx packages/core/src/canvas/Canvas.frameLoop.test.tsx packages/core/src/canvas/Canvas.layerCache.test.tsx
git commit -m "paint the canvas from a frame loop instead of a React effect"
```

---

### Task 2: The view lives in a ref, with an imperative setter on the handle

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx:841-860` (view state), `:829-834` (handle)
- Modify: `packages/core/src/canvas/canvasExtension.ts:24-69`
- Test: `packages/core/src/canvas/Canvas.imperativeView.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/Canvas.imperativeView.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => { makeGLRecorder(); });
afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const IDENTITY = { x: 0, y: 0, scale: { x: 1, y: 1 } };

describe('imperative view', () => {
  it('setView updates getView and paints without a host render', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    let renders = 0;
    function Host() {
      renders++;
      return <Canvas ref={apiRef as never} width={100} height={80} layers={[]} defaultView={IDENTITY} />;
    }
    render(<Host />);
    await frame();
    const before = renders;

    const painted = vi.fn();
    apiRef.current!.subscribeFrame!(painted);
    apiRef.current!.setView!({ x: 40, y: 0, scale: { x: 2, y: 2 } });

    expect(apiRef.current!.getView!()).toEqual({ x: 40, y: 0, scale: { x: 2, y: 2 } });
    await frame();
    await frame();
    expect(painted).toHaveBeenCalledTimes(1);
    expect(renders).toBe(before);
  });

  it('setView accepts an updater and notifies subscribeView', async () => {
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(<Canvas ref={apiRef as never} width={100} height={80} layers={[]} defaultView={IDENTITY} />);
    await frame();

    const seen: number[] = [];
    const stop = apiRef.current!.subscribeView!((v) => seen.push(v.x));
    apiRef.current!.setView!((cur) => ({ ...cur, x: cur.x + 10 }));
    apiRef.current!.setView!((cur) => ({ ...cur, x: cur.x + 10 }));
    stop();
    apiRef.current!.setView!((cur) => ({ ...cur, x: cur.x + 10 }));

    expect(seen).toEqual([10, 20]);
    expect(apiRef.current!.getView!().x).toBe(30);
  });

  it('fires onViewChange for every imperative write', async () => {
    const onViewChange = vi.fn();
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(
      <Canvas ref={apiRef as never} width={100} height={80} layers={[]}
              defaultView={IDENTITY} onViewChange={onViewChange} />,
    );
    await frame();
    apiRef.current!.setView!({ x: 5, y: 5, scale: { x: 1, y: 1 } });
    expect(onViewChange).toHaveBeenCalledWith({ x: 5, y: 5, scale: { x: 1, y: 1 } });
  });

  it('refuses setView while controlled, and says why', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const apiRef = { current: null as CanvasExtensionApi | null };
    render(<Canvas ref={apiRef as never} width={100} height={80} layers={[]} view={IDENTITY} />);
    await frame();

    apiRef.current!.setView!({ x: 99, y: 0, scale: { x: 1, y: 1 } });

    expect(apiRef.current!.getView!()).toEqual(IDENTITY);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('controlled'));
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.imperativeView.test.tsx`
Expected: FAIL — `apiRef.current.setView is not a function`.

- [ ] **Step 3: Replace the view `useState` with a ref plus subscribers**

In `Canvas.tsx`, replace `:845-860`:

```tsx
  // Viewport state: hybrid uncontrolled/controlled. Controlled (`view` prop
  // supplied) is unchanged — the consumer owns the value and every write goes
  // out through `onViewChange`. Uncontrolled state lives in a ref rather than
  // `useState`, so a camera moving at 60 Hz costs no React render; whatever
  // renders the view as DOM subscribes instead.
  const viewRef = useRef<View>(viewProp ?? defaultView ?? { x: 0, y: 0, scale: { x: 1, y: 1 } });
  const isControlled = viewProp !== undefined;
  if (isControlled) viewRef.current = viewProp;
  const viewSubsRef = useRef<Set<(v: View) => void>>(new Set());
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  const viewBoundsRef = useRef(viewBounds);
  viewBoundsRef.current = viewBounds;
  const isControlledRef = useRef(isControlled);
  isControlledRef.current = isControlled;
  const dimsForClampRef = useRef({ width, height });
  dimsForClampRef.current = { width, height };

  const setView = useCallback((next: View | ((current: View) => View)) => {
    const resolved = typeof next === 'function' ? next(viewRef.current) : next;
    const bounds = viewBoundsRef.current;
    const clamped = bounds ? clampView(resolved, bounds, dimsForClampRef.current) : resolved;
    if (isControlledRef.current) {
      // The prop is the authority; writing the ref would put pixels and props
      // out of step with nothing to reconcile them.
      console.warn('[weasel] setView ignored: this canvas is controlled by its `view` prop. Update that prop, or drop it to take the imperative path.');
      onViewChangeRef.current?.(clamped);
      return;
    }
    viewRef.current = clamped;
    for (const fn of viewSubsRef.current) fn(clamped);
    onViewChangeRef.current?.(clamped);
    requestRedraw();
  }, [requestRedraw]);
  const setViewRef = useRef(setView);
  setViewRef.current = setView;

  const getView = useCallback(() => viewRef.current, []);
  const subscribeView = useCallback((fn: (v: View) => void) => {
    viewSubsRef.current.add(fn);
    return () => { viewSubsRef.current.delete(fn); };
  }, []);
```

`effectiveView` is gone as a render-scoped value. Replace its two remaining render-time uses:
- the paint-marking effect from Task 1 — drop `effectiveView` from its dep array and add `viewProp`, so a controlled consumer's new view still marks dirty;
- `usePinchZoomTool(canvasRef, effectiveView, setView, …)` at `:888-893` — Task 3.

Grep for the identifier before moving on: `grep -n effectiveView packages/core/src/canvas/Canvas.tsx` must come back empty.

- [ ] **Step 4: Put the new members on the handle**

`Canvas.tsx:829-834`:

```tsx
  useImperativeHandle(ref, () => ({
    element: canvasRef.current,
    requestRedraw,
    registerLayer,
    hitTestExtras,
    getView,
    setView,
    subscribeView,
    subscribeFrame,
  }), [canvasRef, requestRedraw, registerLayer, hitTestExtras, getView, setView, subscribeView, subscribeFrame]);
```

`canvasExtension.ts`, inside `CanvasExtensionApi` after `requestRedraw`:

```ts
  /** The current view. Readable mid-frame — this is the value the next paint
   *  will use, not a value from the last React commit. */
  getView(): View;
  /**
   * Set the view without a React render: the ref updates now and the next
   * frame paints with it.
   *
   * Ignored, with a console warning, when the canvas is controlled by a `view`
   * prop — there the prop is the authority and this would only desynchronize
   * pixels from props. `onViewChange` still fires either way.
   */
  setView(next: View | ((current: View) => View)): void;
  /** Called after each view change, for chrome that mirrors the camera — a
   *  zoom readout, a minimap, DOM pinned to world coordinates. Returns an
   *  unsubscribe. */
  subscribeView(fn: (view: View) => void): () => void;
  /** Called after each committed paint. For chrome that must read pixels or
   *  count frames; the paint no longer coincides with a React commit. */
  subscribeFrame(fn: () => void): () => void;
```

All four are required members, not optional: both handle construction sites (`Canvas.tsx:829`, `SceneCanvas.tsx:1826`) populate them. Drop the `!` from the test call sites in Tasks 1 and 2 once they typecheck as required.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.imperativeView.test.tsx packages/core/src/canvas/Canvas.frameLoop.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors. `SceneCanvas.tsx:1826` spreads the primitive handle, so the new members reach `SceneCanvasApi` for free.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/canvas/Canvas.tsx packages/core/src/canvas/canvasExtension.ts packages/core/src/canvas/Canvas.imperativeView.test.tsx
git commit -m "give the canvas view an imperative setter, getter and subscription"
```

---

### Task 3: Pinch zoom reads the live view

**Files:**
- Modify: `packages/core/src/tools/builtin/pinchZoom/usePinchZoomTool.ts:36-45`
- Modify: `packages/core/src/canvas/Canvas.tsx:888-893`
- Test: `packages/core/src/tools/builtin/pinchZoom/usePinchZoomTool.test.ts` (extend if present; create with the case below if not)

`usePinchZoomTool` mirrors its `view` argument into a ref on every render (`:42-43`). That worked only because Canvas re-rendered on every view change; after Task 2 it would zoom from a stale base forever.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/tools/builtin/pinchZoom/usePinchZoomTool.test.ts`:

```ts
it('zooms from the current view, not the one captured at mount', () => {
  let live = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const setView = vi.fn((v: View) => { live = v; });
  const el = document.createElement('canvas');
  const ref = { current: el };

  renderHook(() => usePinchZoomTool(ref, () => live, setView, { enabled: true }));

  live = { x: 0, y: 0, scale: { x: 4, y: 4 } };
  pinch(el, { x: 0, y: 0 }, 2);

  expect(setView.mock.calls[0][0].scale.x).toBe(8);
});
```

`pinch` is the existing helper in that file if one exists; otherwise dispatch two `pointerdown`s and a `pointermove` the way `usePinchGesture.test.ts` does, and reuse that helper by importing it.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/tools/builtin/pinchZoom`
Expected: FAIL — receives `2`, the mount-time scale doubled, not `8`.

- [ ] **Step 3: Take a getter**

`usePinchZoomTool.ts:36-45`:

```ts
export function usePinchZoomTool(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  getView: () => View,
  setView: (v: View) => void,
  opts: PinchZoomToolOpts = {},
) {
  const getViewRef = useRef(getView);
  getViewRef.current = getView;
```

and at the write site (`:63`), `viewRef.current` becomes `getViewRef.current()`:

```ts
    const newView = zoomAt(target?.view ?? getViewRef.current(), anchor, scaleFactor, { min, max });
```

`Canvas.tsx:888-893`:

```tsx
  usePinchZoomTool(
    canvasRef,
    getView,
    setView,
    { ...(pinchConfig ?? {}), enabled: pinchConfig !== null, resolveTarget: resolvePinchTarget },
  );
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/tools/builtin/pinchZoom packages/core/src/canvas`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/tools/builtin/pinchZoom packages/core/src/canvas/Canvas.tsx
git commit -m "read the live view in pinch zoom instead of a render-captured copy"
```

---

### Task 4: SceneCanvas stops holding the view in React state

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas.tsx:955-973`, `:1872-1873`
- Test: `packages/core/src/canvas/SceneCanvas.view.test.tsx` (create)

Today SceneCanvas always renders Canvas controlled (`view={effectiveView}`, `:1872`) off its own `useState` (`:961`). That makes the imperative path unreachable for every SceneCanvas consumer — which is all of them that matter here. After this task SceneCanvas renders Canvas *uncontrolled* unless the consumer supplied a `view` prop, and its `currentViewRef` mirror is fed by `subscribeView`.

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/SceneCanvas.view.test.tsx`:

```tsx
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { SceneCanvasApi } from './canvasExtension';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

beforeAll(() => { makeGLRecorder(); });
afterEach(() => { cleanup(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

describe('SceneCanvas view', () => {
  it('pans through the handle without re-rendering the host', async () => {
    const scene = createScene<{ fill: string }, string, { x: number; y: number; width: number; height: number }>({ nodes: [] });
    const apiRef = { current: null as SceneCanvasApi | null };
    let renders = 0;
    function Host() {
      renders++;
      return <SceneCanvas ref={apiRef as never} scene={scene} width={200} height={150} />;
    }
    render(<Host />);
    await frame();
    const before = renders;

    act(() => { apiRef.current!.setView({ x: 25, y: 0, scale: { x: 1, y: 1 } }); });
    await frame();

    expect(apiRef.current!.getView().x).toBe(25);
    expect(renders).toBe(before);
  });

  it('still honors a controlled view prop', async () => {
    const scene = createScene<{ fill: string }, string, { x: number; y: number; width: number; height: number }>({ nodes: [] });
    const apiRef = { current: null as SceneCanvasApi | null };
    const view = { x: 7, y: 7, scale: { x: 1, y: 1 } };
    render(<SceneCanvas ref={apiRef as never} scene={scene} width={200} height={150} view={view} />);
    await frame();
    expect(apiRef.current!.getView()).toEqual(view);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.view.test.tsx`
Expected: FAIL on the first case — the host re-renders, because `handleViewChange` calls `setInternalView`.

- [ ] **Step 3: Drop the state, keep the mirror**

`SceneCanvas.tsx`, replacing `:955-973`:

```tsx
  // The view is owned by the underlying Canvas (a ref, not state) unless the
  // consumer controls it with a `view` prop. `currentViewRef` stays as the
  // synchronous read every HUD, pick and pinch path already uses; it is fed by
  // the canvas's view subscription rather than by a render.
  const currentViewRef = useRef<View>(
    viewProp ?? defaultView ?? { x: 0, y: 0, scale: { x: 1, y: 1 } },
  );
  if (viewProp !== undefined) currentViewRef.current = viewProp;

  useEffect(() => {
    const api = canvasApiRef.current;
    if (!api) return;
    currentViewRef.current = api.getView();
    return api.subscribeView((v) => { currentViewRef.current = v; });
  }, [canvasReady]);

  // Writes from actions (`viewport.pan` / `viewport.zoom` via the `view` dep)
  // land on the canvas imperatively. Controlled consumers get the callback and
  // nothing else — the same contract Canvas enforces.
  const handleViewChange = useCallback((v: View) => {
    if (viewProp === undefined) canvasApiRef.current?.setView(v);
    onViewChangeProp?.(v);
  }, [viewProp, onViewChangeProp]);
```

`canvasReady` is a `useState<boolean>` set in the merged ref callback at `:1823-1834` — the handle is null on the first render, so the subscription effect needs a signal that it landed. Add it next to `canvasApiRef`:

```tsx
  const [canvasReady, setCanvasReady] = useState(false);
```

and in the ref callback, after `canvasApiRef.current = extended;`:

```tsx
    setCanvasReady(extended !== null);
```

This is the same pattern `apps/draw/src/App.tsx:1598-1603` had to invent for `useHud`; it belongs in the kit.

At `:1872-1873`, hand Canvas the view only when controlled:

```tsx
      {...(viewProp !== undefined ? { view: viewProp } : { defaultView })}
      onViewChange={handleViewChange}
```

Note the loop this avoids: `handleViewChange` is Canvas's `onViewChange`, and Canvas fires it from inside `setView`. Calling `api.setView(v)` from it would recurse — except that the call arrives *because* the consumer's action wrote through the `view` dep (`deps/view.ts:31`, `set: (v) => onViewChange(v)`), not from Canvas. Keep the two paths distinct: `handleViewChange` is the dep's write path; Canvas's own `onViewChange` notification is wired to `onViewChangeProp` only. Concretely, pass Canvas a separate callback:

```tsx
  const notifyViewChange = useCallback((v: View) => {
    onViewChangeProp?.(v);
  }, [onViewChangeProp]);
```

and use `onViewChange={notifyViewChange}` on the `<Canvas>` element, leaving `handleViewChange` for `useViewDepSource` (`:2409`) and `StandardActionsRegistrar` (`:1927`).

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/canvas/SceneCanvas.view.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Run every SceneCanvas suite**

Run: `npx vitest run --project=kit packages/core/src/canvas packages/core/src/interactions`
Expected: PASS. Pay attention to `SceneCanvas.dispatcher.test.tsx` and `CanvasView.test.tsx` — per-view cameras call `surface().requestRedraw()` (`CanvasView.tsx:153`), which now marks dirty instead of re-rendering, so any assertion that counted renders needs re-reading against the new contract rather than being relaxed.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/canvas/SceneCanvas.tsx packages/core/src/canvas/SceneCanvas.view.test.tsx
git commit -m "move the SceneCanvas view out of React state onto the canvas handle"
```

---

### Task 5: `getPaintedVersion()` — the consistency guarantee, on request

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx` (paint callback, handle), `canvasExtension.ts`
- Test: `packages/core/src/canvas/Canvas.imperativeView.test.tsx` (extend)

Decoupling trades away single-commit consistency between React-rendered DOM and canvas pixels. Chrome that genuinely needs lockstep gets a way to ask what the pixels show.

- [ ] **Step 1: Write the failing test**

Append to `Canvas.imperativeView.test.tsx`:

```tsx
it('reports the scene version the pixels were painted from', async () => {
  const apiRef = { current: null as CanvasExtensionApi | null };
  let version = 3;
  render(
    <Canvas ref={apiRef as never} width={100} height={80} layers={[]}
            defaultView={IDENTITY} contentVersion={() => version} />,
  );
  await frame();
  expect(apiRef.current!.getPaintedVersion()).toBe(3);

  version = 4;
  expect(apiRef.current!.getPaintedVersion()).toBe(3);

  apiRef.current!.requestRedraw();
  await frame();
  await frame();
  expect(apiRef.current!.getPaintedVersion()).toBe(4);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.imperativeView.test.tsx -t painted`
Expected: FAIL — `getPaintedVersion is not a function`.

- [ ] **Step 3: Stamp the paint**

`CanvasProps` (`Canvas.tsx`, next to `dpr` at `:220-225`):

```ts
  /** The version of whatever content this canvas draws, sampled at paint time
   *  and reported by `getPaintedVersion()`. `<SceneCanvas>` wires this to
   *  `scene.getVersion`. Chrome that must not show DOM ahead of pixels
   *  compares the two and defers a frame. */
  contentVersion?: () => number;
```

In `CanvasInner`:

```tsx
  const contentVersionRef = useRef(contentVersion);
  contentVersionRef.current = contentVersion;
  const paintedVersionRef = useRef(0);
  const getPaintedVersion = useCallback(() => paintedVersionRef.current, []);
```

and as the last statement of `paint()`, after `renderer.render(...)`:

```tsx
    paintedVersionRef.current = contentVersionRef.current?.() ?? 0;
```

Add `getPaintedVersion` to the handle and to `CanvasExtensionApi`:

```ts
  /** The `contentVersion` the current pixels were painted from. Chrome in
   *  lockstep with canvas content compares this against the version it is
   *  about to render and defers a frame when they differ. */
  getPaintedVersion(): number;
```

In `SceneCanvas.tsx`, on the `<Canvas>` element: `contentVersion={scene.getVersion}`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.imperativeView.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/canvas packages/core/src/canvas/canvasExtension.ts
git commit -m "report the content version the canvas pixels were painted from"
```

---

### Task 6: `syncPaint` — opt back into paint-at-commit

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx`
- Test: `packages/core/src/canvas/Canvas.frameLoop.test.tsx` (extend)

For consumers with heavy DOM chrome pinned to canvas content, one frame of skew is worse than the render cost. `syncPaint` restores today's behavior wholesale.

- [ ] **Step 1: Write the failing test**

Append to `Canvas.frameLoop.test.tsx`:

```tsx
it('paints during the commit when syncPaint is set', async () => {
  const sinkRef = { current: null as DebugSink | null };
  const { rerender } = render(
    <Canvas width={100} height={80} layers={[]} debug debugSinkRef={sinkRef} syncPaint />,
  );
  await frame();
  const spy = vi.spyOn(sinkRef.current!, 'beginFrame');

  act(() => { rerender(<Canvas width={120} height={80} layers={[]} debug debugSinkRef={sinkRef} syncPaint />); });

  // No frame awaited: the paint already happened inside the commit.
  expect(spy).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.frameLoop.test.tsx -t syncPaint`
Expected: FAIL — `beginFrame` not called yet; the paint is queued on a frame.

- [ ] **Step 3: Implement it**

`CanvasProps`:

```ts
  /** Paint inside the React commit rather than on the next animation frame.
   *  Costs a synchronous paint per commit; buys single-commit consistency
   *  between React-rendered DOM and canvas pixels. For consumers with DOM
   *  chrome pinned to canvas content that cannot tolerate a frame of skew. */
  syncPaint?: boolean;
```

Replace the dirty-marking effect from Task 1 with a pair — the sync one must be a layout effect so it lands before the browser paints the DOM:

```tsx
  const syncPaintRef = useRef(syncPaint);
  syncPaintRef.current = syncPaint;

  useLayoutEffect(() => {
    if (!syncPaint) return;
    dirtyRef.current = false;
    paintRef.current();
    for (const fn of frameSubsRef.current) fn();
  });

  useEffect(() => {
    if (syncPaint) return;
    requestRedraw();
  }, [layersWithDebug, width, height, viewProp, debugSink, dprProp,
      layerVisibility, layerOrder, syncPaint, requestRedraw]);
```

and in `requestRedraw`, flush immediately in sync mode:

```tsx
  const requestRedraw = useCallback(() => {
    dirtyRef.current = true;
    if (syncPaintRef.current) {
      dirtyRef.current = false;
      paintRef.current();
      for (const fn of frameSubsRef.current) fn();
      return;
    }
    scheduleFrame();
  }, [scheduleFrame]);
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.frameLoop.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/canvas
git commit -m "add a syncPaint prop for consumers that need paint at commit time"
```

---

### Task 7: Frame-loop lifecycle — unmount, StrictMode, hidden documents

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx`
- Test: `packages/core/src/canvas/Canvas.frameLoop.test.tsx` (extend)

- [ ] **Step 1: Write the failing tests**

Append to `Canvas.frameLoop.test.tsx`:

```tsx
it('cancels its pending frame on unmount', async () => {
  const cancel = vi.spyOn(window, 'cancelAnimationFrame');
  const apiRef = { current: null as CanvasExtensionApi | null };
  const { unmount } = render(<Host apiRef={apiRef} />);
  await frame();
  act(() => { apiRef.current!.requestRedraw(); });
  unmount();
  expect(cancel).toHaveBeenCalled();
  cancel.mockRestore();
});

it('does not paint while the document is hidden', async () => {
  const apiRef = { current: null as CanvasExtensionApi | null };
  render(<Host apiRef={apiRef} />);
  await frame();
  const painted = vi.fn();
  apiRef.current!.subscribeFrame(painted);

  const spy = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
  act(() => { apiRef.current!.requestRedraw(); });
  await frame();
  await frame();
  expect(painted).not.toHaveBeenCalled();

  spy.mockRestore();
  document.dispatchEvent(new Event('visibilitychange'));
  await frame();
  await frame();
  expect(painted).toHaveBeenCalledTimes(1);
});
```

The second case pins the contract that matters: hidden means *deferred*, not dropped. A canvas that skipped the paint and cleared the flag would come back from a background tab showing a stale frame.

- [ ] **Step 2: Run them and watch them fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.frameLoop.test.tsx`
Expected: FAIL on the hidden case — it paints anyway.

- [ ] **Step 3: Implement**

In `scheduleFrame`, hold the dirty flag while hidden:

```tsx
  const scheduleFrame = useCallback(() => {
    if (rafRef.current !== 0) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      paintRef.current();
      for (const fn of frameSubsRef.current) fn();
    });
  }, []);
```

and add the resume plus the teardown:

```tsx
  useEffect(() => {
    const onVisible = () => { if (!document.hidden && dirtyRef.current) scheduleFrame(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      if (rafRef.current !== 0) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
  }, [scheduleFrame]);
```

StrictMode's double-mount is covered by this teardown: the first mount's pending frame is cancelled on its cleanup, and `dirtyRef` starts `true` on the second, so the surface repaints. Nothing else in the loop is shared across mounts — `glRendererRef` already has its own dispose effect (`Canvas.tsx:1290-1295`).

- [ ] **Step 4: Run the tests, then the full canvas suite**

Run: `npx vitest run --project=kit packages/core/src/canvas`
Expected: PASS.

- [ ] **Step 5: Verify under a real StrictMode double-mount**

Run: `npm run dev:kit` and open the side-scroller demo; confirm one canvas, one loop, no doubled motion. Both apps mount under StrictMode (`apps/site/main.tsx:47`).

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/canvas
git commit -m "own the frame loop's lifecycle across unmount and hidden documents"
```

---

### Task 8: Non-subscribing scene access

**Files:**
- Modify: `packages/core/src/core/scene/useScene.ts:76`
- Test: `packages/core/src/core/scene/useScene.test.ts` (extend)

`useScene` re-renders its host on every scene mutation (`useSyncExternalStore` at `:76`). A frame loop never needs that; a consumer rendering DOM from scene data does.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/core/scene/useScene.test.ts`:

```ts
it('does not re-render the host when subscribe is false', () => {
  let renders = 0;
  const { result } = renderHook(() => {
    renders++;
    return useScene<{ fill: string }, string, Box>(
      { nodes: [{ id: 'a', layer: 'default', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { fill: '#f00' } }] },
      { subscribe: false },
    );
  });
  const before = renders;

  act(() => { result.current.setPose('a', { x: 5, y: 0, width: 10, height: 10 }); });

  expect(renders).toBe(before);
  expect(result.current.get('a')!.pose.x).toBe(5);
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/core/scene/useScene.test.ts -t subscribe`
Expected: FAIL — the host re-rendered.

- [ ] **Step 3: Implement**

`useScene.ts` — add to `UseSceneOptions` in `core/scene/types.ts` next to `getActiveJournal` (`:250`):

```ts
  /** Re-render the host on every scene mutation. Default `true`. Set `false`
   *  when the scene is read by a frame loop rather than by a render — a game
   *  loop, a simulation — and nothing in the host's DOM derives from it. */
  subscribe?: boolean;
```

and at `useScene.ts:76`:

```ts
  const subscribed = opts?.subscribe !== false;
  useSyncExternalStore(
    subscribed ? scene.subscribe : NEVER_SUBSCRIBE,
    scene.getVersion,
    scene.getVersion,
  );
```

with, at module scope:

```ts
/** A subscribe function that never notifies. `useSyncExternalStore` still runs
 *  (hooks are unconditional) but the host is never re-rendered by the store. */
const NEVER_SUBSCRIBE = () => () => {};
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/core/scene`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/core/scene
git commit -m "let useScene opt out of re-rendering its host per mutation"
```

---

### Task 9: World-anchored DOM tracks a ref-driven camera

**Files:**
- Modify: `packages/core/src/features/text/useSceneTextEdit.ts:133-153`
- Test: `packages/core/src/features/text/useSceneTextEdit.test.ts` (extend)

`getScreenPose` projects through `optsRef.current.view` (`:140`) — a value from the consumer's last render. Controlled consumers (WeaselDraw passes `view` from its own `useState`, `apps/draw/src/App.tsx:1526`) are unaffected. An uncontrolled SceneCanvas consumer would see the text overlay freeze while the canvas pans under it. The overlay's rAF poll (`useTextEdit.ts:612-617`) already re-reads every frame, so it only needs a live source.

- [ ] **Step 1: Write the failing test**

Add to `packages/core/src/features/text/useSceneTextEdit.test.ts`:

```ts
it('projects through a view thunk, re-read per call', () => {
  let live: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
  const { result } = renderHook(() => useSceneTextEdit({ scene, view: () => live }));

  expect(result.current.getScreenPose('t')!.x).toBe(10);
  live = { x: 4, y: 0, scale: { x: 1, y: 1 } };
  expect(result.current.getScreenPose('t')!.x).toBe(6);
});
```

(`'t'` is a text node at world x = 10; build it with the same helper the file's existing cases use.)

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/features/text/useSceneTextEdit.test.ts -t thunk`
Expected: FAIL — a function is passed where a `View` is read; `view.x` is `undefined` and the projection is `NaN`.

- [ ] **Step 3: Accept either**

In `useSceneTextEdit.ts`, widen the option:

```ts
  /** The camera to project through. A thunk is re-read on every projection,
   *  which is what a ref-driven camera needs — pass `api.getView` from the
   *  canvas handle. A plain `View` is read from the render that supplied it. */
  view: View | (() => View);
```

and at `:140`:

```ts
    const v = typeof optsRef.current.view === 'function'
      ? optsRef.current.view()
      : optsRef.current.view;
```

replacing the direct reads of `optsRef.current.view` in the body with `v`.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/features/text`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/text
git commit -m "let the text-edit overlay project through a live view thunk"
```

---

### Task 10: The side-scroller camera stops costing a render per frame

**Files:**
- Modify: `apps/site/demos/SceneScrollerDemo.tsx`
- Test: `apps/site/demos/__tests__/SceneScrollerDemo.test.tsx` (extend)

This is the demo the spec was written from, and the reference implementation for a game camera on the kit.

- [ ] **Step 1: Read what it does now**

Run: `grep -n "view\|setView\|useState" apps/site/demos/SceneScrollerDemo.tsx`

The camera is React state fed by the fixed-step loop in `apps/site/demos/platformer/world.ts`; each step sets it, each set re-renders.

- [ ] **Step 2: Write the failing test**

Add to `apps/site/demos/__tests__/SceneScrollerDemo.test.tsx`:

```tsx
it('advances the camera without re-rendering the demo', async () => {
  let renders = 0;
  function Counting() { renders++; return <SceneScrollerDemo />; }
  render(<Counting />);
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
  const before = renders;

  // Six simulated frames.
  for (let i = 0; i < 6; i++) {
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }

  expect(renders).toBe(before);
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx vitest run --project=kit apps/site/demos/__tests__/SceneScrollerDemo.test.tsx -t camera`
Expected: FAIL — one render per simulated frame.

- [ ] **Step 4: Route the camera through the handle**

Hold the `SceneCanvasApi` in a ref, drop the camera `useState`, and in the per-step callback:

```tsx
    apiRef.current?.setView(cameraView(camera));
```

where `cameraView` is the existing conversion from `platformer/camera.ts` state to a `View`. Remove the `view={…}` prop from `<SceneCanvas>` so it runs uncontrolled; keep `defaultView` for the starting camera. Use `useScene(..., { subscribe: false })` from Task 8 for the scene the loop mutates.

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=kit apps/site/demos`
Expected: PASS.

- [ ] **Step 6: Verify in the browser**

Run `npm run dev:kit`, open the scene-scroller demo, and confirm the camera still tracks with the dead zone intact and the parallax bands move. Then re-measure against the table in `docs/TODO.md` ("Side-scroller (scene graph) — landed"): record frames committed/s, main-thread busy/s, and major GC over a ten-second window with DevTools tracing on. **Put the new numbers in the TODO table next to the old ones rather than replacing the section** — the point of the arc is the delta.

- [ ] **Step 7: Commit**

```bash
git add apps/site/demos
git commit -m "drive the side-scroller camera through the canvas handle"
```

---

### Task 11: Docs, TODO, changeset

**Files:**
- Modify: `docs/concepts.md`, `docs/TODO.md`
- Create: `.changeset/<name>.md`

- [ ] **Step 1: Write the rule down**

In `docs/concepts.md`, in the canvas/rendering section, add — stated as a rule, not a narrative:

```markdown
### Paint and render are separate

The canvas paints from its own animation frame, not from a React render.
`requestRedraw()` marks it dirty; the next frame paints. A view written through
`setView()` on the canvas handle costs no render at all.

The consequence is that canvas pixels can be one frame ahead of DOM rendered
from the same data. For readouts and panels that is invisible. For DOM pinned
to world coordinates, position it from `subscribeView` rather than from render
state, so both come from the same frame.

**Do not render scene-derived DOM inside `startTransition`.** React defers a
transition deliberately and nothing forces it to catch up, so that DOM can
diverge from the canvas without bound. Chrome that must be in lockstep compares
`getPaintedVersion()` against the version it is about to render and defers a
frame; a consumer that wants the old whole-cloth guarantee sets `syncPaint`.
```

- [ ] **Step 2: Update the TODO**

In `docs/TODO.md`, the "(P1) A per-frame camera costs a React render per frame" entry under the side-scroller section is now closed — replace the entry with the measured result from Task 10 Step 6. Leave the "(P1) `setPose` demands a fresh pose object per node per frame" entry alone; the ephemeral-overrides plan closes that one.

- [ ] **Step 3: Write the changeset**

```bash
cat > .changeset/frame-loop-decoupling.md <<'EOF'
---
'@weasel-js/core': patch
---

Paint the canvas from its own animation frame instead of from a React render.
`requestRedraw()` marks the surface dirty and the next frame paints, so many
redraws in a tick cost one paint. The view gains an imperative path on the
canvas handle — `setView` / `getView` / `subscribeView` — and `SceneCanvas` no
longer holds it in React state, so a camera moving at 60 Hz costs no renders.
Consumers passing a `view` prop stay controlled and are unaffected.

Canvas pixels may now be one frame ahead of DOM rendered from the same data.
Position world-anchored DOM from `subscribeView`; compare `getPaintedVersion()`
when chrome must be in lockstep; set `syncPaint` to paint at commit time as
before. Do not render scene-derived DOM inside `startTransition` — React defers
it and nothing forces it to catch up.
EOF
```

The level is `patch`. Every changeset in this repo is `patch` regardless of what the change does (`CLAUDE.md`, "Releases: always write `patch`"), and a `bump-approved` marker is never written by an implementer.

- [ ] **Step 4: Verify the whole gate**

Run: `npx tsc --noEmit && npm run test:unit && npm run lint && npm run check:bumps`
Expected: all pass. Then the visual baselines: `npm run test:visual`. The harness already waits two animation frames plus 150 ms (`tests/visual/diff.ts:81-86`), which the loop satisfies — but a local pass does not imply CI passes for hairline strokes; check the CI run rather than assuming.

- [ ] **Step 5: Commit**

```bash
git add docs .changeset
git commit -m "document the paint/render split and record the frame-loop result"
```

---

## Self-Review

**Spec coverage.** Part 1's paragraphs map to tasks as follows: frame loop → 1; `setView`/`getView`/`subscribeView` → 2, with the controlled-prop refusal tested; `useScene` non-subscribing form → 8 (as an option rather than a second hook — one hook with a flag beats two hooks that differ in one line); version stamping → 5; `syncPaint` → 6; test/lifecycle work → 1 Step 6, 7, and 11 Step 4; world-anchored DOM → 9. The `startTransition` case is Task 11's rule; the spec's "dev-mode warning if that is detectable" is deliberately not built, and the File Structure section says why.

**Not covered by any task, on purpose:** `MinimapCanvas` (`:102-105`) and `SceneViewCanvas` (`:76`) keep their scene subscriptions — they render DOM/canvas from scene data on their own schedule and are not in the per-frame path.

**Gap found and closed during review:** Task 4's first draft had `handleViewChange` calling `canvasApiRef.current.setView(v)` while also being passed as Canvas's `onViewChange`, which recurses on the first imperative write. Step 3 now splits the dep's write path from Canvas's notification path.

**Type consistency:** `setView(next: View | ((current: View) => View))` is the signature in Task 2's implementation, the interface, and the updater test; `subscribeView(fn: (view: View) => void): () => void` and `subscribeFrame(fn: () => void): () => void` are used identically in Tasks 1, 2, 4 and 7; `getPaintedVersion(): number` pairs with the `contentVersion?: () => number` prop in Task 5. `canvasReady` is introduced in Task 4 Step 3 before its use in the same step's effect.
