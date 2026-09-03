# Annotations arc 2 — paint target and input target come apart

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the `paintInto` / `inputElement` spike on `<Canvas>` into real API — a ref whose element type is honest, a public handle that names both elements, and HUDs that survive detachment.

**Architecture:** `<Canvas>` currently keeps one ref, typed `HTMLCanvasElement`, and lies to it under `paintInto` by casting the caller's input element through it. Split the two roles it was carrying: `canvasRef` becomes an `HTMLElement` ref meaning *where input, focus and measurement live*, and a new `ownCanvasRef` holds the `<canvas>` this component renders, for the one place that needs `getContext`. The public `CanvasExtensionApi` gains the same split — `element` widens to `HTMLElement`, and a new `surface` returns the canvas pixels land on. Everything downstream of `canvasRef` only ever calls `addEventListener`, `getBoundingClientRect`, `style`, `classList` and `parentElement`, so widening those is a free type change.

**Tech stack:** TypeScript, React 19, vitest (`--project=kit`), Playwright for the real-GL guards.

**Spec:** `docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`, arc 2. Arc 1 is merged.

---

## Decisions this plan encodes

**`CanvasExtensionApi` gets two named fields.** Chosen by Mike on 2026-09-02 against "input box only" and "paint canvas only":

```ts
readonly element: HTMLElement | null;          // where input, focus, the cursor live
readonly surface: HTMLCanvasElement | null;    // where pixels land
```

Attached, both are the same `<canvas>`. Detached, `element` is the caller's input box and `surface` is the caller's shared canvas. The loupe is the consumer that proves the split — it reads GL pixels off one and listens for `pointermove` on the other.

**Widening a `RefObject`'s element type costs no test churn.** TypeScript's object properties are covariant, so `RefObject<HTMLCanvasElement | null>` is assignable to `RefObject<HTMLElement | null>`. Verified on this tree's tsc; the ~20 test files that declare `useRef<HTMLCanvasElement | null>` and pass it into these hooks keep compiling untouched. Do not retype them.

**Widening `clientToWorld`'s first parameter is a real, small break.** Under `strictFunctionTypes`, a consumer who *annotated* the callback's first param as `HTMLCanvasElement` stops compiling; one who let it infer is fine. Verified. Say so in the changeset prose.

**The detached loupe's aim is out of scope.** `createLoupe` gets the `canvas` / `input` split so call sites compile and the attached case is unchanged, but a loupe aimed at a pane inside a shared buffer also needs its readback origin offset by the pane rect. That is a feature, not a de-SPIKE. Task 9 files it.

---

## File structure

**Modified — core, the split itself**
- `packages/core/src/canvas/canvasExtension.ts` — `element` widens, `surface` added
- `packages/core/src/canvas/Canvas.tsx` — `canvasRef` widens, `ownCanvasRef` added, both casts deleted, handle rebuilt, HUDs render when detached, SPIKE labels replaced

**Modified — core, free widenings downstream of `canvasRef`**
- `packages/core/src/core/viewport/clientToCanvas.ts`
- `packages/core/src/core/viewport/usePinchGesture.ts`
- `packages/core/src/tools/builtin/pinchZoom/usePinchZoomTool.ts`
- `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx`
- `packages/core/src/features/chrome-caps/useHoverTracking.ts`
- `packages/core/src/canvas/deps/ingestion.ts`
- `packages/core/src/canvas/SceneCanvas/PointerProviderIfRoot.tsx`
- `packages/core/src/canvas/SceneCanvas.tsx`
- `packages/core/src/features/text/useSceneTextEdit.ts`

**Modified — HUDs**
- `packages/core/src/canvas/CursorCoordsHud.tsx`
- `packages/core/src/canvas/PickHud.tsx`
- `packages/core/src/canvas/ModalityHud.tsx`

**Modified — the loupe and its call sites**
- `packages/hud/src/loupe/createLoupe.ts`
- `apps/draw/src/useLoupe.ts`
- `apps/site/demos/LoupeDemo.tsx`

**Created**
- `packages/core/src/canvas/Canvas.detached.test.tsx` — the arc's own test file
- `.changeset/annotations-arc-2-paint-input-split.md`

---

### Task 1: `CanvasExtensionApi` names both elements

**Files:**
- Modify: `packages/core/src/canvas/canvasExtension.ts:26-29`
- Modify: `packages/core/src/canvas/Canvas.tsx:960-973`
- Test: `packages/core/src/canvas/Canvas.detached.test.tsx` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/canvas/Canvas.detached.test.tsx`. The `beforeAll` block is copied from `Canvas.huds.test.tsx` — jsdom needs `getContext` and the pointer-capture stubs to exist before `<Canvas>` mounts.

```tsx
/**
 * `<Canvas>` under `paintInto` / `inputElement`: the ref handle, the HUDs and
 * the input plumbing when the element painted into is not the element input
 * comes from.
 *
 * jsdom cannot paint, so nothing here asserts pixels — the real-GL guards for
 * that live in `tests/visual/tiled-surface.spec.ts`. What jsdom *can* see is
 * which element each role resolved to, which is the whole subject of this arc.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import { Canvas } from './Canvas';
import type { CanvasExtensionApi } from './canvasExtension';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('<Canvas> ref handle: element vs surface', () => {
  it('attached, element and surface are both the canvas it rendered', async () => {
    const ref = createRef<CanvasExtensionApi>();
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(<Canvas ref={ref} width={200} height={200} layers={{}} />));
    });
    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(ref.current?.element).toBe(canvas);
    expect(ref.current?.surface).toBe(canvas);
  });

  it('detached, element is the input box and surface is the canvas painted into', async () => {
    const ref = createRef<CanvasExtensionApi>();
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);

    await act(async () => {
      render(
        <Canvas
          ref={ref}
          width={200}
          height={200}
          layers={{}}
          paintInto={{ canvas: shared, x: 40, y: 10 }}
          inputElement={input}
        />,
      );
    });

    expect(ref.current?.element).toBe(input);
    expect(ref.current?.surface).toBe(shared);

    shared.remove();
    input.remove();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.detached.test.tsx`

Expected: both tests FAIL. The first fails on `surface` being `undefined`; the second fails on `element` being the input box only by accident of the existing cast, and on `surface` being `undefined`.

- [ ] **Step 3: Widen the public interface**

In `packages/core/src/canvas/canvasExtension.ts`, replace the `element` member (currently lines 26-29):

```ts
  /** Where pointer input, focus and the cursor live, and the element every
   *  client→world conversion measures. Null until the canvas mounts.
   *
   *  Normally the `<canvas>` the component renders, so `element === surface`.
   *  Under `paintInto` it is the caller's `inputElement` instead — a plain box
   *  over one pane of a shared surface — so use {@link surface} for anything
   *  that needs the pixels. */
  readonly element: HTMLElement | null;
  /** The canvas pixels land on. Null until the canvas mounts.
   *
   *  Under `paintInto` this is the caller's shared canvas, which co-tenant
   *  panes also paint into: its rect is the whole surface, not this pane's, so
   *  read geometry off {@link element} rather than off this. */
  readonly surface: HTMLCanvasElement | null;
```

- [ ] **Step 4: Populate both on the handle**

In `packages/core/src/canvas/Canvas.tsx`, replace the `element:` line in the `useImperativeHandle` call (currently line 963) and extend the dep array (line 972):

```ts
  useImperativeHandle(ref, () => ({
    // Named rather than read off `canvasRef` so the handle rebuilds when a
    // detached surface's input element arrives, which is a render later.
    element: detached ? inputElement ?? null : canvasRef.current,
    surface: detached ? paintInto?.canvas ?? null : ownCanvasRef.current,
    requestRedraw,
    subscribeFrame,
    registerLayer,
    hitTestExtras,
    getView,
    setView,
    subscribeView,
    getPaintedVersion,
  }), [canvasRef, ownCanvasRef, detached, inputElement, paintInto?.canvas,
       requestRedraw, subscribeFrame, registerLayer,
       hitTestExtras, getView, setView, subscribeView, getPaintedVersion]);
```

`ownCanvasRef` does not exist yet — Task 2 adds it. Until then this step will not compile; that is expected and Task 2 closes it. If you would rather keep the tree compiling between tasks, add the one line `const ownCanvasRef = useRef<HTMLCanvasElement | null>(null);` next to `canvasRef` now and let Task 2 wire it to the JSX.

- [ ] **Step 5: Run the test again**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.detached.test.tsx`

Expected: PASS, 2 tests. If the attached case fails on `surface` being null, `ownCanvasRef` is not yet bound to the `<canvas>` — finish Task 2 first and re-run.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/canvas/canvasExtension.ts \
        packages/core/src/canvas/Canvas.tsx \
        packages/core/src/canvas/Canvas.detached.test.tsx
git commit -m "name both elements on the canvas ref handle"
```

---

### Task 2: `canvasRef` widens to `HTMLElement`, and the casts go

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx:826-838` (the refs), `:1357` (paint), `:1476-1490` (detached listeners), `:1525` (the JSX ref)

- [ ] **Step 1: Split the two refs**

Replace lines 826-832 (`const canvasRef = …` through the cast):

```ts
  // The element input comes from and every client→world conversion measures.
  // Normally the `<canvas>` this component renders; under `paintInto` it is
  // the caller's `inputElement` instead — nothing downstream of here asks
  // which of the two it is holding, because nothing downstream needs a canvas.
  const canvasRef = useRef<HTMLElement | null>(null);
  // The `<canvas>` this component rendered, if it rendered one. `paint` is the
  // only thing that needs a real canvas, for `getContext`.
  const ownCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const detached = !!paintInto;
  if (detached) {
    canvasRef.current = inputElement ?? null;
  }
```

- [ ] **Step 2: Point `paint` at the canvas ref**

At line 1357, replace:

```ts
    const c = paintTargetRef.current ?? canvasRef.current;
```

with:

```ts
    const c = paintTargetRef.current ?? ownCanvasRef.current;
```

- [ ] **Step 3: Bind both refs from the JSX**

At line 1525, replace `ref={canvasRef}` on the `<canvas>` with a callback that writes both:

```tsx
        ref={(el) => { ownCanvasRef.current = el; canvasRef.current = el; }}
```

- [ ] **Step 4: Drop the second cast**

In the detached pointer-listener effect (around line 1485), replace:

```ts
      const [worldX, worldY] = toWorld(
        el as unknown as HTMLCanvasElement, e.clientX, e.clientY, view, clientToWorldRef.current,
      );
```

with:

```ts
      const [worldX, worldY] = toWorld(
        el, e.clientX, e.clientY, view, clientToWorldRef.current,
      );
```

This will not compile until Task 4 widens `toWorld`. Run Task 4 before typechecking, or widen `toWorld`'s first parameter to `HTMLElement` now and let Task 4 handle the prop that feeds it.

- [ ] **Step 5: Confirm no cast survives**

Run: `grep -n "as unknown as HTMLCanvasElement" packages/core/src/canvas/Canvas.tsx`

Expected: no output.

- [ ] **Step 6: Run the arc's tests plus the canvas suite**

Run: `npx vitest run --project=kit packages/core/src/canvas/`

Expected: PASS. Every existing canvas test keeps passing — none of them read `canvasRef`'s type.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/canvas/Canvas.tsx
git commit -m "hold the input element in a ref that admits it is not a canvas"
```

---

### Task 3: widen the element-only consumers

Every hook and component below takes a ref or an element typed `HTMLCanvasElement` and does nothing canvas-specific with it — `addEventListener`, `getBoundingClientRect`, `style`, `classList`, `parentElement`, identity comparison. Widening each is mechanical.

**Files:**
- Modify: `packages/core/src/core/viewport/usePinchGesture.ts:19`
- Modify: `packages/core/src/tools/builtin/pinchZoom/usePinchZoomTool.ts:43,57`
- Modify: `packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx:152,472`
- Modify: `packages/core/src/features/chrome-caps/useHoverTracking.ts:20,40`
- Modify: `packages/core/src/canvas/deps/ingestion.ts:14,31`
- Modify: `packages/core/src/canvas/SceneCanvas/PointerProviderIfRoot.tsx:34,40`
- Modify: `packages/core/src/canvas/SceneCanvas.tsx:931,2152,2475`

- [ ] **Step 1: Widen each declaration**

In each file, change the ref's element type from `HTMLCanvasElement` to `HTMLElement`. The declarations are, respectively:

```ts
// usePinchGesture.ts:19
  canvasRef: React.RefObject<HTMLElement | null>,

// usePinchZoomTool.ts:43 and :57
  canvasRef: React.RefObject<HTMLElement | null>,

// useGestureDispatcher.tsx:152 and :472
  canvasRef: React.RefObject<HTMLElement | null>;

// useHoverTracking.ts:20 and :40
  canvasRef: React.RefObject<HTMLElement | null>,

// deps/ingestion.ts:14 and :31
  canvasRef: React.RefObject<HTMLElement | null>,

// PointerProviderIfRoot.tsx:34 and :40 (PointerPublisher)
  canvasRef: React.MutableRefObject<HTMLElement | null>;

// SceneCanvas.tsx:931
  const internalCanvasRef = useRef<HTMLElement | null>(null);
// SceneCanvas.tsx:2152 and :2475
  canvasRef: React.RefObject<HTMLElement | null>;
```

Change nothing else in these files. If any body turns out to call `.width`, `.height`, `.getContext`, `.toDataURL` or `.captureStream`, stop — that file belongs in Task 4's list instead, not here, and the plan is wrong about it.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` **from the repo root** (not `-p packages/core/tsconfig.json`, which exits 1 with 31 pre-existing TS6059 errors that are not yours).

Expected: clean, apart from anything Task 4 still owes (`toWorld`, `clientToCanvas`, `clientToWorld`).

- [ ] **Step 3: Run the affected suites**

Run: `npx vitest run --project=kit packages/core/src/interactions packages/core/src/canvas packages/core/src/features/chrome-caps packages/core/src/tools`

Expected: PASS. No test file needs retyping — a `RefObject<HTMLCanvasElement | null>` still satisfies a `RefObject<HTMLElement | null>` parameter.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/core/viewport/usePinchGesture.ts \
        packages/core/src/tools/builtin/pinchZoom/usePinchZoomTool.ts \
        packages/core/src/interactions/dispatcher/useGestureDispatcher.tsx \
        packages/core/src/features/chrome-caps/useHoverTracking.ts \
        packages/core/src/canvas/deps/ingestion.ts \
        packages/core/src/canvas/SceneCanvas/PointerProviderIfRoot.tsx \
        packages/core/src/canvas/SceneCanvas.tsx
git commit -m "widen the pointer-path refs from canvas to element"
```

---

### Task 4: the coordinate helpers take an element

`clientToCanvas`, `toWorld` and the `clientToWorld` prop all take an element only to call `getBoundingClientRect()` on it.

**Files:**
- Modify: `packages/core/src/core/viewport/clientToCanvas.ts:7-14`
- Modify: `packages/core/src/canvas/Canvas.tsx:745-753` (`toWorld`), `:318` (the `clientToWorld` prop)
- Test: `packages/core/src/canvas/Canvas.detached.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/canvas/Canvas.detached.test.tsx`:

```tsx
describe('<Canvas> detached client→world', () => {
  it('measures the input element, not the canvas painted into', async () => {
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);

    // The pane sits 400px into the shared surface. If a conversion measured
    // the surface instead of the box, the x it reports would be off by 400.
    shared.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 820, height: 400, right: 820, bottom: 400 }) as DOMRect;
    input.getBoundingClientRect = () =>
      ({ left: 400, top: 0, width: 380, height: 360, right: 780, bottom: 360 }) as DOMRect;

    const seen: HTMLElement[] = [];
    await act(async () => {
      render(
        <Canvas
          width={380}
          height={360}
          layers={{}}
          paintInto={{ canvas: shared, x: 400, y: 0 }}
          inputElement={input}
          clientToWorld={(el, cx, cy) => {
            seen.push(el);
            const r = el.getBoundingClientRect();
            return [cx - r.left, cy - r.top];
          }}
        />,
      );
    });

    await act(async () => {
      input.dispatchEvent(
        new PointerEvent('pointermove', { clientX: 450, clientY: 30, bubbles: true }),
      );
    });

    expect(seen.length).toBeGreaterThan(0);
    for (const el of seen) expect(el).toBe(input);

    shared.remove();
    input.remove();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.detached.test.tsx -t "measures the input element"`

Expected: FAIL — a TypeScript error on the `clientToWorld` callback's `el` parameter, since the prop still declares `HTMLCanvasElement` and the test's arrow infers it as such while `el.getBoundingClientRect()` is fine but `expect(el).toBe(input)` compares against an `HTMLDivElement`. If instead it passes outright, the assertion is not sensitive to what you are about to change — make it fail first by temporarily pointing the detached listener at `paintInto.canvas` and confirm it goes red, then put it back.

- [ ] **Step 3: Widen `clientToCanvas`**

In `packages/core/src/core/viewport/clientToCanvas.ts`, change the signature (keep the docstring, adjusting "canvas" to "element" in the first line):

```ts
/**
 * Convert client coords to element CSS-pixel coords (relative to the element's
 * top-left). Apps drawing in CSS-pixel space feed the result directly into
 * world math when pan/zoom is identity. With pan/zoom, compose this with
 * your inverse-viewport transform.
 */
export function clientToCanvas(
  canvas: HTMLElement,
  clientX: number,
  clientY: number,
): [number, number] {
  const rect = canvas.getBoundingClientRect();
  return [clientX - rect.left, clientY - rect.top];
}
```

This is a pure relaxation for callers — every canvas still passes.

- [ ] **Step 4: Widen `toWorld` and the prop**

In `packages/core/src/canvas/Canvas.tsx`, line 746:

```ts
function toWorld(
  canvas: HTMLElement,
```

and line 318:

```ts
  clientToWorld?: (canvas: HTMLElement, cx: number, cy: number) => [number, number];
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.detached.test.tsx`

Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/core/viewport/clientToCanvas.ts \
        packages/core/src/canvas/Canvas.tsx \
        packages/core/src/canvas/Canvas.detached.test.tsx
git commit -m "take an element, not a canvas, in the client-to-world helpers"
```

---

### Task 5: double-click text editing stops requiring a canvas

`useSceneTextEdit` gates on `e.target instanceof HTMLCanvasElement`, so under `paintInto` the event target is the input div and text editing silently no-ops.

**Files:**
- Modify: `packages/core/src/features/text/useSceneTextEdit.ts:206-214`
- Test: `packages/core/src/features/text/useSceneTextEdit.test.ts:186-200`

- [ ] **Step 1: Write the failing test**

Add this immediately after the existing `'un-projects a double-click through the thunk read at click time'` test (which ends at line 200). It is that test with one thing changed — the event target is a `<div>` rather than a `<canvas>` — so the assertion isolates exactly the gate.

```ts
  it('opens the editor from a double-click whose target is not a canvas', () => {
    // Under `paintInto` the dblclick target is the caller's input box, so the
    // old `instanceof HTMLCanvasElement` gate made text editing a silent no-op
    // on every detached surface.
    let live: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const { hook, container } = renderThunkEdit(() => live);
    const box = document.createElement('div');
    container.appendChild(box);

    live = { x: 100, y: 50, scale: { x: 1, y: 1 } };
    act(() => hook.result.current.onDoubleClick({
      target: box, clientX: 10, clientY: 10,
    } as unknown as MouseEvent<HTMLElement>));
    expect(hook.result.current.editingId).toBe('a');
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/features/text/useSceneTextEdit.test.ts -t "not a canvas"`

Expected: FAIL — `editingId` is `null`, because the `instanceof HTMLCanvasElement` gate returned early. Confirm the *sibling* canvas test still passes in the same run; if it does not, the harness broke rather than the gate.

- [ ] **Step 3: Relax the gate**

In `packages/core/src/features/text/useSceneTextEdit.ts`, replace lines 207-210:

```ts
  const onDoubleClick = useCallback((e: MouseEvent<HTMLElement>) => {
    // The dblclick bubbles from the canvas up to any wrapping container; the
    // element it started on is what the click coordinates are relative to.
    const canvas = e.target instanceof HTMLElement ? e.target : null;
    if (!canvas) return;
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run --project=kit packages/core/src/features/text/`

Expected: PASS, both the new test and the canvas-target sibling.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/text/
git commit -m "open the text editor from a double-click on any host element"
```

---

### Task 6: the HUDs survive detachment

`<Canvas>` returns `null` when detached, before the HUD JSX, so `CursorCoordsHud`, `PickHud` and `ModalityHud` drop entirely. Two things are needed: render them, and anchor them to the right box.

Attached, the HUDs anchor to `canvasRef.current.parentElement` — the wrapper a bare `<canvas>` sits in. Detached, that parent is the *shared surface container*, so every pane's HUD would stack in the same corner. The right anchor detached is the input box itself.

**Files:**
- Modify: `packages/core/src/canvas/CursorCoordsHud.tsx:17-23,39`
- Modify: `packages/core/src/canvas/PickHud.tsx:14-20,41`
- Modify: `packages/core/src/canvas/ModalityHud.tsx:15-21,30`
- Modify: `packages/core/src/canvas/Canvas.tsx:1520-1568`
- Test: `packages/core/src/canvas/Canvas.detached.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/canvas/Canvas.detached.test.tsx`:

```tsx
describe('<Canvas> HUDs when detached', () => {
  it('renders the cursor-coords HUD even with no canvas of its own', async () => {
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);

    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Canvas
          width={200}
          height={200}
          layers={{}}
          paintInto={{ canvas: shared, x: 0, y: 0 }}
          inputElement={input}
          cursorCoordsHud
        />,
      ));
    });

    // The HUD is the only thing this render can produce: detached, <Canvas>
    // renders no element of its own.
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
    expect(container.querySelector('canvas')).toBeNull();

    shared.remove();
    input.remove();
  });

  it('anchors a detached HUD to the input box, not to the shared container', async () => {
    const host = document.createElement('div');
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    host.append(shared, input);
    document.body.append(host);

    const measured: Element[] = [];
    for (const [el, rect] of [
      [host, { left: 0, top: 0, width: 820, height: 400 }],
      [input, { left: 400, top: 0, width: 380, height: 360 }],
    ] as const) {
      el.getBoundingClientRect = () => {
        measured.push(el);
        return { ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height } as DOMRect;
      };
    }

    await act(async () => {
      render(
        <Canvas
          width={380}
          height={360}
          layers={{}}
          paintInto={{ canvas: shared, x: 400, y: 0 }}
          inputElement={input}
          cursorCoordsHud
        />,
      );
    });

    // The anchor measured the pane, not the strip it sits in. Both panes'
    // HUDs would otherwise resolve to the same corner.
    expect(measured).toContain(input);
    expect(measured).not.toContain(host);

    host.remove();
  });
});
```

- [ ] **Step 2: Run it and watch both fail**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.detached.test.tsx -t "detached"`

Expected: both FAIL — the first because `container` is empty, the second because nothing measured anything.

- [ ] **Step 3: Give each HUD an explicit anchor**

In each of the three HUD files, widen the ref and add the anchor prop. `CursorCoordsHud.tsx` (lines 17-23 and 39):

```ts
/** Props for `<CursorCoordsHud>`. */
export interface CursorCoordsHudProps {
  canvasRef: React.RefObject<HTMLElement | null>;
  /** Element the HUD pins its corner to. Defaults to the canvas's parent — the
   *  wrapper a bare `<canvas>` sits in. A detached canvas passes its own input
   *  box, whose parent is the shared surface every pane sits in. */
  anchorRef?: React.RefObject<HTMLElement | null>;
  viewRef: React.RefObject<View>;
  /** Inset from the canvas's top-right corner, in px. Default 8 on both axes. */
  offset?: { top?: number; right?: number };
}
```

```tsx
export function CursorCoordsHud({ canvasRef, anchorRef, viewRef, offset }: CursorCoordsHudProps) {
```

```tsx
  const { ref, style: anchorStyle } = useHostAnchor(
    () => anchorRef?.current ?? canvasRef.current?.parentElement ?? canvasRef.current,
```

Make the identical three changes in `PickHud.tsx` (prop interface at line 14-20, destructure at 36, `useHostAnchor` at 41) and `ModalityHud.tsx` (interface at 15-21, destructure at 27, `useHostAnchor` at 30). `ModalityHud` has no `viewRef`; leave its other props alone.

- [ ] **Step 4: Render the HUDs when detached**

In `packages/core/src/canvas/Canvas.tsx`, replace the bare `if (detached) return null;` at line 1520 with a return that keeps the HUD fragment. Extract the HUD block into a local first so it is written once:

```tsx
  const huds = (
    <>
      {cursorCoordsHud && (
        <CursorCoordsHud
          canvasRef={canvasRef}
          {...(detached ? { anchorRef: canvasRef } : {})}
          viewRef={viewRef}
        />
      )}
      {pickHud && (
        <PickHud
          canvasRef={canvasRef}
          {...(detached ? { anchorRef: canvasRef } : {})}
          viewRef={viewRef}
          pickEvery={stablePickEveryForHud}
          pickBest={stablePickBestForHud}
        />
      )}
      {modalityHud && (
        <ModalityHud
          canvasRef={canvasRef}
          {...(detached ? { anchorRef: canvasRef } : {})}
          modeId={typeof modalityHud === 'object' ? modalityHud.modeId : undefined}
        />
      )}
    </>
  );

  // Detached: no element of our own, but the HUDs are DOM and still belong to
  // this pane. Held until the input element arrives — `useHostAnchor` resolves
  // its host once on mount and again only when the panel or the window moves,
  // so a HUD mounted against a null host would latch off.
  if (detached) return inputElement ? huds : null;

  return (
    <>
      <canvas
        ref={(el) => { ownCanvasRef.current = el; canvasRef.current = el; }}
        …unchanged…
      />
      {huds}
    </>
  );
```

Keep the `<canvas>` element's existing props exactly as they are, including the `onContextMenu` comment block. Delete the three inline HUD blocks that followed it — they now live in `huds`.

- [ ] **Step 5: Run the test**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.detached.test.tsx`

Expected: PASS, 5 tests.

- [ ] **Step 6: Run the existing HUD suite**

Run: `npx vitest run --project=kit packages/core/src/canvas/Canvas.huds.test.tsx`

Expected: PASS, unchanged — the attached path resolves the same host it always did.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/canvas/CursorCoordsHud.tsx \
        packages/core/src/canvas/PickHud.tsx \
        packages/core/src/canvas/ModalityHud.tsx \
        packages/core/src/canvas/Canvas.tsx \
        packages/core/src/canvas/Canvas.detached.test.tsx
git commit -m "keep the HUDs when a canvas paints into someone else's surface"
```

---

### Task 7: the loupe asks for the canvas and the input box separately

`createLoupe` takes one `element` and uses it for both `getContext`/`width`/`height` and `getBoundingClientRect`/`addEventListener`. `api.element` is no longer a canvas, so the three call sites stop compiling. Split the option.

Note `createLoupe`'s body already has a local `surface` (a `LoupeSurface` from `@weasel-js/loupe`) — do not reuse that name for the new option.

**Files:**
- Modify: `packages/hud/src/loupe/createLoupe.ts:20-22,81`
- Modify: `apps/draw/src/useLoupe.ts:54-57`
- Modify: `apps/site/demos/LoupeDemo.tsx:95-98`

- [ ] **Step 1: Rename the option and add the input split**

In `packages/hud/src/loupe/createLoupe.ts`, replace the `element` member of `LoupeOptions` (lines 20-22):

```ts
  /** The canvas pixel mode reads back from. Supplies the GL context and the
   *  drawing-buffer dimensions. */
  canvas: HTMLCanvasElement;
  /** Where the aim comes from: the element pointer events are taken from and
   *  the rect client coords are measured against. Defaults to `canvas`, which
   *  is right whenever the canvas is also the thing under the pointer. */
  input?: HTMLElement;
```

and at line 81, replace the destructure:

```ts
  const { hud, canvas: element, source, requestRedraw } = opts;
  const input = opts.input ?? element;
```

Then change the three pointer/rect uses from `element` to `input` — the `getBoundingClientRect` at line 210, and the `addEventListener` / `removeEventListener` pair at lines 216 and 221. Leave every `element.getContext`, `element.width` and `element.height` alone: those are the readback, and they belong to the canvas.

The two `element.getBoundingClientRect()` calls inside `refreshPixels` (lines 141 and 171) compute the DPR as `element.width / cssRect.width`. Both halves of that ratio must describe the same box, so leave them on `element`.

- [ ] **Step 2: Update the call sites**

`apps/draw/src/useLoupe.ts` — replace the guard and the option:

```ts
    if (!api?.surface) return;
```

```ts
      canvas: api.surface,
      ...(api.element ? { input: api.element } : {}),
```

`apps/site/demos/LoupeDemo.tsx` — the same two edits at lines 95 and 98.

- [ ] **Step 3: Typecheck and run the hud suite**

Run: `npx tsc --noEmit` from the repo root, then `npx vitest run --project=kit packages/hud/`

Expected: both clean. If `packages/hud` tests live under a different vitest project, run `npm test` and read the whole output in the foreground — do not background it and read an exit code.

- [ ] **Step 4: Commit**

```bash
git add packages/hud/src/loupe/createLoupe.ts \
        apps/draw/src/useLoupe.ts \
        apps/site/demos/LoupeDemo.tsx
git commit -m "let the loupe read pixels and take aim from two elements"
```

---

### Task 8: the props stop saying SPIKE

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx:319-334`

`SceneCanvasProps` is `Omit<CanvasProps, …>`, so these two doc comments are what a `<SceneCanvas>` consumer reads. They currently open with "SPIKE (arc 2)".

- [ ] **Step 1: Rewrite both doc comments**

```ts
  /**
   * Paint into a caller-owned canvas at a rect on it, instead of an element
   * this component creates. `x`/`y` are the rect's top-left in that canvas's
   * CSS pixels; the rect's size is the existing `width`/`height` props.
   *
   * Requires `inputElement`: with no element of its own there is nowhere for
   * pointer input, focus or the cursor to live, and nothing renders.
   *
   * N canvases can then share one GL context and one buffer. Each needs its
   * own `<WeaselProvider isolate>` — under a shared `<ActionsProvider>` only
   * the newest responds to input and the rest go silently dead.
   */
  paintInto?: { canvas: HTMLCanvasElement | null; x: number; y: number };
  /**
   * The element pointer input, focus and the cursor come from, and the element
   * every client→world conversion measures. Only read alongside `paintInto`;
   * an attached canvas uses the one it renders.
   */
  inputElement?: HTMLElement | null;
```

- [ ] **Step 2: Confirm nothing still calls this a spike**

Run: `grep -rn "SPIKE (arc 2)" packages/ apps/ tests/ | grep -v node_modules`

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/canvas/Canvas.tsx
git commit -m "document paintInto and inputElement as the API they are"
```

---

### Task 9: file the detached loupe as follow-up

**Files:**
- Modify: `docs/TODO.md`

- [ ] **Step 1: Add the entry**

Add under whichever section covers canvas/HUD work, matching the file's existing entry format (a `- **(P<n>) <Title>.**` lead, then prose):

```markdown
- **(P3) The loupe cannot aim at a detached pane.** Surfaced 2026-09-02 by annotations arc 2. `createLoupe` now takes `canvas` and `input` separately, so a pane's pointer aim is measured against the pane box — but `readbackRegion` still reads the aim as an offset into the *whole* drawing buffer. Over a `paintInto` surface the two disagree by the pane's origin, so the lens shows the wrong part of the buffer. Fix is to carry the target rect into the readback, which means `createLoupe` needs the pane origin (or the `CanvasExtensionApi` needs to expose the target rect it hands `WeaselRenderer.setTarget`). Nothing consumes this yet: the tiled-surface demo mounts no loupe.
```

- [ ] **Step 2: Fix the index too**

`docs/TODO.md` has a hand-maintained index at the top that duplicates claims further down. Add the matching index line, or confirm the section you added to is not indexed. Fix both or neither.

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "note that the loupe cannot aim at a detached pane"
```

---

### Task 10: the full gate, a screenshot, and a changeset

- [ ] **Step 1: Typecheck, lint, unit**

Run each in the foreground and read the output — a backgrounded vitest has reported exit 0 with a real failure sitting in the suite:

```bash
npx tsc --noEmit
npm run lint
npx vitest run --project=kit
```

Expected: clean; kit tests at or above the 5257 that were green at arc 1's merge, plus the new ones.

- [ ] **Step 2: Run the visual suite separately**

`npm test` does not run it. A red spec reached `main` through exactly that gap on 2026-09-02.

```bash
npx playwright test --config=tests/visual/playwright.config.ts
```

Expected: 44 specs pass, including the three in `tests/visual/tiled-surface.spec.ts`.

- [ ] **Step 3: Look at the demo**

jsdom cannot catch a layout collapse, and this arc changes what `<Canvas>` returns. Start the dev server in the background, open `#tiled-surface`, and screenshot it:

```bash
npm run dev:kit
```

Both panes must still render, drags must still land on the mark in the 2× pane, and — new this arc — a HUD must appear over the pane it belongs to when one is enabled. Send the screenshot to the wall:

```bash
~/src/slopboard/bin/slop <screenshot>   # zone: weasel
```

- [ ] **Step 4: Write the changeset**

Create `.changeset/annotations-arc-2-paint-input-split.md`. **`patch`, always** — `minor` and `major` are Mike's calls, made explicitly, and `npm run check:bumps` enforces it. Do not write a `bump-approved` marker.

```markdown
---
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

Split a canvas's paint target from its input target.

`<SceneCanvas paintInto={{ canvas, x, y }} inputElement={el}>` paints into a
rect of a canvas you own and takes pointer input from an element you own, so N
canvases share one GL context and one buffer. Each needs its own
`<WeaselProvider isolate>`.

The ref handle names both elements: `element` is where input, focus and the
cursor live, and is now typed `HTMLElement` because detached it is not a canvas;
`surface` is where pixels land. Attached, they are the same `<canvas>` and
`element` keeps working as before.

Breaking, narrowly: `createLoupe`'s `element` option is now `canvas`, with an
optional `input` for the element aim is measured against. `CanvasExtensionApi.element`
no longer satisfies a `HTMLCanvasElement` — read `surface` for pixels. And
`clientToWorld`'s first parameter widens to `HTMLElement`, which stops compiling
for a consumer who annotated that parameter as `HTMLCanvasElement`; one who let
it infer is unaffected.
```

- [ ] **Step 5: Check the bump**

```bash
npm run check:bumps
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add .changeset/annotations-arc-2-paint-input-split.md
git commit -m "add a changeset for the paint/input split"
```

---

## Merging

`main` is checked out in `.claude/worktrees/trunk`, so this checkout cannot `git switch main`. Merge `main` into the branch first, then fast-forward trunk:

```bash
git merge main
git -C .claude/worktrees/trunk merge --ff-only labkit/annotations
```

Leave that worktree in place — do not prune it.

**`main` has never been pushed and is a long way ahead of `origin/main`. Pushing needs Mike's explicit say-so, every time; "merge to main" does not authorize it.**

Delete this plan in the merge commit. A merged plan on disk reads as open work.

---

## Traps this arc walks into

**Watch a test fail before you believe it.** Arc 1's edge-clipping guard passed with the scissor removed *and* with the viewport wrong, because each clips drawing independently — only losing both fails it. The equivalent here: an assertion that a HUD "renders when detached" passes against a HUD anchored to the wrong element. That is why Task 6 has two tests and not one.

**A jsdom API that exists but has no consequence produces a test that cannot fail.** `setPointerCapture` is a real function under jsdom that records the call and does nothing, so `pointerup` is never retargeted. If a test here depends on capture semantics, assert a proxy on this side of the boundary and say in the test that it is one.

**jsdom cannot catch a layout collapse.** Task 10 step 3 is not optional. `<Canvas>` changing what it returns is exactly the shape that renders an empty page with every test green.

**The git stash stack is shared by every worktree of this repo.** Do not `stash`/`pop` — a pop in one worktree can land another session's work in it. Use a throwaway worktree for a baseline.

**Stage explicit paths, never `git add -A`.** Another session can join this checkout without warning; check `git status` before staging.
