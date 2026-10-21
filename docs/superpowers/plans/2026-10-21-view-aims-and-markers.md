# View aims, held side and markers (lens-views arc 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every viewport on a weasel surface answers its aim and says which side it holds, and any view can be either end of a marker that the kit draws and drags. That is enough for a PiP `<CanvasView>` to show the root view's aim and pan the root camera when the aim is dragged, and for kernel3d to answer an aim for its camera.

**Architecture:** A dimension-free aim contract (`ViewAim`, `AimSpace`) lives in `features/viewports/aim.ts`. Core's 2D implementation (a world rect) sits beside it, and kernel3d's frustum implementation lives in kernel3d. `<CanvasView>` gains an aim-held form that feeds its existing derived-camera thunk. The view registry answers and writes aims for every view, the root included, and holds the marker declarations. Markers paint as screen-space layers in their target's frame, and one core action, bound to their affordance, drags them.

**Tech Stack:** TypeScript, React 18, vitest (the jsdom `core` and `weasel-ui` projects), `@weasel-js/geom`, `@weasel-js/geom/3d`, `@weasel-js/routing`.

**Spec:** `docs/superpowers/specs/2026-10-21-lens-views-design.md`. This plan builds only its "Arc 1". Read the whole spec anyway: arcs 2–3 are what this API has to serve.

## Decisions this plan makes (the spec left them to the builder)

- **The aim contract is an object, not a shape.** `ViewAim<TExtent>` carries `viewId`, a `kind` tag, an opaque `extent`, and two methods, `outlineIn(space)` and `pannedIn(space, from, to)`. A target view is described to it as an `AimSpace`, with `project` / `unproject` between world points and frame px. Why: core never reads the extent's fields, so a 3D frustum fits through the same door as a 2D rect.
- **World points are `{ x, y, z? }`, and a 2D world is the plane `z = 0`.** Why: one convention lets core's rect aim draw into a 3D space and kernel3d's frustum draw into a 2D one, without core naming a 3D type.
- **The held side lives on `<CanvasView>`'s props and on the view registration.** `aim` / `onAimChange` replace `view` / `defaultView` / `onViewChange` / `viewBounds`, as a type-level either/or. An aim-held view's camera is the existing derived-camera thunk, built from the aim by `viewForAim(rect, frame, 'contain')`. Why: the spec asks to widen the derived-camera mechanism, and either/or props make "both stored" unrepresentable.
- **An aim-held view answers the aim it holds, not the wider rect its camera shows.** The two differ when the aim's aspect differs from the frame's. Why: the held value is the one source of truth, and reporting a derived one would be a second.
- **Camera-held writes use `viewForAim(rect, frame, 'exact')`**, the per-axis inverse of `viewportWorldRect`, so a pan keeps the scale it had. Aim-held cameras use `'contain'` (uniform, centered), so a lens never stretches.
- **A marker is declared with a `<ViewMarker>` element or with `SurfaceContribution.markers`.** Both feed one registry. Why not `<CanvasView>` props: the root view has no element to hang a marker on, and arc 3's minimap is a contribution. There is no `markers` prop and no imperative `addMarker`, because nothing in arcs 1–3 declares a marker that way.
- **Markers are hit as registered-layer affordances** (`layerAffordance('view-marker:<id>', …)`, so the kind is `layer:view-marker:<id>`). One action, `view.marker.drag`, drags them, and an always-on ambient entry installs it the way long-press feedback is installed. Why: it reuses the arbitration that HUD widgets already win against the select tool, instead of adding a second hit pathway.
- **Root writes go through a new `SurfaceHandle.setView`**, wired to the canvas's `setViewFromInput`. That path already clamps to `viewBounds`, forwards a controlled view to `onViewChange`, and stops a running `animateView` glide (`SceneCanvas/useCanvasCamera.ts:32-35`).
- **The default marker style matches the minimap indicator**: stroke `#ffffff`, width `1`, dash `[2, 3]`, in screen px. Why: when arc 3 swaps the indicator for a marker, nothing visible changes.
- **There is no site demo in this arc.** CLAUDE.md's demo conventions don't require one for new API. `CanvasViewDemo.tsx` gets its PiP marker in arc 3, which is where the spec puts it ("PiP: … gains the optional marker").

## Global Constraints

- Core imports nothing from `@weasel-js/lens`, `@weasel-js/loupe` or `@weasel-js/kernel3d`. `npm run check:imports` (part of the gate) is the guard.
- Core's aim contract may not require `{x, y, width, height}`. Only the 2D implementation (`RectAim`) and `<CanvasView>`'s `aim` prop speak rects.
- One pathway: a view's aim is derived from its camera, or its camera from its aim. The two are never both stored.
- No consumer-facing `@internal` import. `ViewRegistry`, `ViewRegistration` and `SurfaceHandle` stay `@internal`. Whatever tests and later arcs need goes on `SceneCanvasApi` or is exported from the barrel by name.
- New barrel exports are named (`export { … } from`), never an `export *` of another workspace package.
- This arc adds no `DepSchema` key, so the `declare module` hop trap does not apply.
- `npm run check:size` allows 400 lines per file and 120 per function. The `CanvasView` function is allow-listed at 249 lines (`scripts/check-size.allow.json:21-23`) and may not grow, so new logic goes into hooks in their own files.
- Every changeset is `patch`, and its prose says what breaks.
- Commit subjects are imperative and present tense, and messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tests run one file at a time locally. Core uses `npx vitest run --project=core <file>`; kernel3d uses `npx vitest run --project=weasel-ui <file>` (`vitest.config.ts:158-175`). Typecheck, browser runs and anything wider go to the fleet on a commit.

## Review Focus

- **A marker whose source or target names no mounted view, or whose source is its own target**, paints nothing, grabs nothing and throws nothing. A `<ViewMarker>` that mounts before its `<CanvasView>` is ordinary (Task 4).
- **An unmeasured frame or a zero-size aim** gives a finite camera from `viewForAim`, never `NaN` or `Infinity` (Task 1).
- **A marker drag on a `features={['draw']}` surface** pans the source and starts no marquee or move in the target view (Task 5).
- **A marker drag on a root camera that is controlled, clamped by `viewBounds`, or mid-`animateView`** reaches `onViewChange` clamped and ends the glide (Task 5).
- **A by-value source with no `setAim`, or a marker with `interactive={false}`**, is not grabbed, and the press falls through to the target view's own bindings (Task 5).

---

## Setup (before Task 1)

From the main checkout:

```bash
git worktree add -b feat/view-aims .claude/worktrees/view-aims main
```

Then move the session into it with `EnterWorktree` (`path: .claude/worktrees/view-aims`) and run:

```bash
npm ci
npm run check:test-projects   # expect core → `core`, kernel3d → `weasel-ui`
```

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/features/viewports/aim.ts` (create) | `ViewAim`, `AimSpace`, `AimPoint`, `AimOutline`; `RectAim`, `rectAim`, `isRectAim`, `aimSpace2d`, `viewForAim` |
| `packages/core/src/features/viewports/viewMarker.ts` (create) | `ViewMarkerProps`, `AimSource`, `ViewMarkerStyle`, `ViewMarkerGrab`; `createViewMarkerLayer`, `grabViewMarker`. Pure, no React. |
| `packages/core/src/features/viewports/viewMarkerDrag.ts` (create) | `VIEW_MARKER_DRAG`, `viewMarkerDragAction`, `createViewMarkerContribution` |
| `packages/core/src/features/viewports/index.ts` (modify) | exports the three modules above by name |
| `packages/core/src/canvas/useViewAim.ts` (create) | `<CanvasView>`'s held side: the camera options it hands `useCanvasView`, and its registration's `aim()` / `setAim()` |
| `packages/core/src/canvas/ViewMarker.tsx` (create) | `<ViewMarker>`, which registers a marker with the surface's view registry |
| `packages/core/src/canvas/SceneCanvas/SurfaceDeclarations.tsx` (create) | renders the surface's declared views and markers; takes over `SceneCanvas.tsx:160-164` so `SceneCanvasInner` stays under 120 lines |
| `packages/kernel3d/src/aim.ts` (create) | `Aim3d`, `Frustum3d`, `aimOf3d`, `aimSpace3d`, `cameraOfAim3d` |
| Existing core and kernel3d files (modify) | wiring; each task names its files and line ranges |

---

### Task 1: The aim contract and core's 2D aim

**Files:**
- Create: `packages/core/src/features/viewports/aim.ts`
- Modify: `packages/core/src/features/viewports/index.ts`. `barrel/viewport.ts:11` already does `export * from '../features/viewports'`, an internal module, so the new names reach the barrel through it.
- Test: `packages/core/src/features/viewports/aim.test.ts`

**Interfaces:**
- Produces:

```ts
/** A point in a view's world. A 2D world is the plane z = 0, so `z` is absent there. */
export interface AimPoint { x: number; y: number; z?: number }
/** A closed outline in a frame's CSS px, from the frame's top-left; at least 3 points. */
export type AimOutline = readonly { x: number; y: number }[];

/** A target view, as an aim is drawn into it: its world, and its frame. */
export interface AimSpace {
  /** The view whose frame this is; `null` for a surface's root view. */
  readonly viewId: string | null;
  /** `'2d'` for core's views; any other value is its owner's (kernel3d: `'3d'`). */
  readonly kind: string;
  readonly size: { width: number; height: number };
  /** World point to frame px; `null` where the point does not draw (behind a 3D camera). */
  project(p: AimPoint): { x: number; y: number } | null;
  /** Frame px to the world point under it; `null` where there is none (a 3D ray missing its plane). */
  unproject(px: { x: number; y: number }): AimPoint | null;
}

/** What a viewport shows, read in the world of the view it names. */
export interface ViewAim<TExtent = unknown> {
  readonly viewId: string | null;
  /** Discriminates `extent`: `'rect'` for core's 2D views. */
  readonly kind: string;
  /** Where the aim lies in its world, in its owner's own terms. */
  readonly extent: TExtent;
  /** The aim's outline in `space`'s frame, or `null` when it cannot be drawn there. */
  outlineIn(space: AimSpace): AimOutline | null;
  /** This aim moved so the world point under frame px `from` in `space` ends up under `to`; `null` when either misses. */
  pannedIn(space: AimSpace, from: { x: number; y: number }, to: { x: number; y: number }): ViewAim<TExtent> | null;
}

export type RectAim = ViewAim<Bounds> & { readonly kind: 'rect' };
export function rectAim(viewId: string | null, rect: Bounds): RectAim;
export function isRectAim(aim: ViewAim): aim is RectAim;
/** A 2D view's frame: `view` is its camera and `size` its frame; frame px are measured from the frame's top-left. */
export function aimSpace2d(viewId: string | null, view: View, size: Dims): AimSpace;
/** The camera that shows `rect` in a frame of `size`: `'exact'` per axis (the inverse of `viewportWorldRect`), `'contain'` uniform and centered. Normalized. */
export function viewForAim(rect: Bounds, size: Dims, fit: 'exact' | 'contain'): View;
```

`Bounds` is core's type from `core/viewport/fitViewToBounds`, and `Dims` is the one in `core/layers/render`.

- [ ] **Step 1: Write the failing tests** in `aim.test.ts`

```ts
const CAM: View = { x: 0, y: 0, scale: { x: 0.25, y: 0.25 } };
const PIP = { width: 140, height: 105 };
it('projects a 2D aim through a target camera', () => {
  expect(rectAim(null, { x: 0, y: 0, width: 400, height: 300 }).outlineIn(aimSpace2d('pip', CAM, PIP)))
    .toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 75 }, { x: 0, y: 75 }]);
});
it('pans by the world distance between two frame points', () => {
  const moved = rectAim(null, { x: 0, y: 0, width: 400, height: 300 })
    .pannedIn(aimSpace2d('pip', CAM, PIP), { x: 50, y: 20 }, { x: 60, y: 30 });
  expect(moved!.extent).toEqual({ x: 40, y: 40, width: 400, height: 300 });
  expect(moved!.viewId).toBeNull();
});
it('unprojects to a point with no z, and ignores z when projecting', () => {
  const s = aimSpace2d(null, { x: 10, y: 20, scale: { x: 2, y: 2 } }, { width: 100, height: 100 });
  expect(s.unproject({ x: 4, y: 6 })).toEqual({ x: 12, y: 23 });
  expect(s.project({ x: 12, y: 23, z: 99 })).toEqual({ x: 4, y: 6 });
});
it('inverts viewportWorldRect exactly', () => {
  const v: View = { x: -15, y: 20, scale: { x: 2, y: 0.5 } };
  expect(viewForAim(viewportWorldRect(v, { width: 200, height: 100 }), { width: 200, height: 100 }, 'exact')).toEqual(v);
});
it('fits uniformly and centered under contain', () => {
  expect(viewForAim({ x: 10, y: 20, width: 50, height: 50 }, { width: 200, height: 100 }, 'contain'))
    .toEqual({ x: -15, y: 20, scale: { x: 2, y: 2 } });
});
// Review Focus: unmeasured frame, zero-size aim
it.each([
  [{ x: 0, y: 0, width: 0, height: 0 }, { width: 200, height: 100 }],
  [{ x: 0, y: 0, width: 50, height: 50 }, { width: 0, height: 0 }],
])('gives a finite camera for %o in %o', (rect, size) => {
  for (const fit of ['exact', 'contain'] as const) {
    const v = viewForAim(rect, size, fit);
    expect([v.x, v.y, v.scale.x, v.scale.y].every(Number.isFinite)).toBe(true);
  }
});
it('tells a rect aim from another kind', () => {
  const r = rectAim(null, { x: 0, y: 0, width: 1, height: 1 });
  expect(isRectAim(r)).toBe(true);
  expect(isRectAim({ ...r, kind: 'frustum' })).toBe(false);
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project=core packages/core/src/features/viewports/aim.test.ts`
Expected: FAIL with `Cannot find module './aim'`.

- [ ] **Step 3: Implement `aim.ts`**

- `rectAim(...).outlineIn` projects the rect's four corners clockwise from the top-left, and returns `null` if any corner projects to `null`.
- `pannedIn` adds `unproject(to) − unproject(from)` (x and y; z ignored) to the rect's origin.
- `viewForAim` passes its result through `normalizeView`, which keeps the zero cases finite. Where an extent is zero, use the floored scale rather than dividing by it.
- `AimPoint`'s doc comment states the `z = 0` convention.

- [ ] **Step 4: Run the test and confirm it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Export the new names** from `features/viewports/index.ts` by name: `rectAim`, `isRectAim`, `aimSpace2d`, `viewForAim`, and the types `ViewAim`, `AimSpace`, `AimPoint`, `AimOutline` and `RectAim`.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/features/viewports/aim.ts packages/core/src/features/viewports/aim.test.ts packages/core/src/features/viewports/index.ts
git commit -m "add a view aim contract and core's 2D rect aim"
```

---

### Task 2: kernel3d answers an aim for its camera

**Files:**
- Create: `packages/kernel3d/src/aim.ts`
- Modify: `packages/kernel3d/src/index.ts`
- Test: `packages/kernel3d/src/aim.test.ts`

**Interfaces:**
- Consumes:
  - from `@weasel-js/core`, already a peer dependency: `ViewAim`, `AimSpace`, `AimPoint` and `AimOutline` as type imports, and `aimSpace2d` in the test;
  - from kernel3d itself: `Viewport3d` and `rayAt` (`./deps`), `projectPoint` (`./project`), and `Camera3d` (`./camera`).
- Produces:

```ts
/** The frustum a camera shows: its eye, and its near and far rectangles, corners clockwise from the top-left as seen. */
export interface Frustum3d { eye: Vec3; near: readonly [Vec3, Vec3, Vec3, Vec3]; far: readonly [Vec3, Vec3, Vec3, Vec3] }
export type Aim3d = ViewAim<Frustum3d> & { readonly kind: 'frustum'; readonly viewport: Viewport3d };
export function aimOf3d(viewport: Viewport3d, viewId: string | null): Aim3d;
/** A 3D pane as a target. It projects through `projectPoint` and unprojects onto the plane z = 0, where 2D worlds lie. */
export function aimSpace3d(viewport: Viewport3d, viewId: string | null): AimSpace; // kind '3d'
/** The camera an aim was read from, which is what a by-value source's writer sets. */
export function cameraOfAim3d(aim: Aim3d): Camera3d;
```

How the frustum aim behaves:

| Call | Target | Result |
|---|---|---|
| `outlineIn` | a `'3d'` space | the far rectangle's corners, through `space.project` |
| `outlineIn` | any other space | the four corner rays (`rayAt` at the pane corners) met with the plane z = 0, through `space.project`. `null` if a ray misses the plane in front of the eye, or a corner projects to `null`. |
| `pannedIn` | any space | `aimOf3d` of the viewport with `camera.target` shifted by `unproject(to) − unproject(from)`, a missing z counting as 0 |

- [ ] **Step 1: Write the failing tests** in `aim.test.ts`

The viewport is `const VP: Viewport3d = { camera: createCamera({}), width: 200, height: 100 }`: the eye is at z = 10, looking at the origin, with fov π/4.

```ts
const FLAT = aimSpace2d(null, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 });
it('outlines its own pane at the frame corners', () => {
  const out = aimOf3d(VP, 'p').outlineIn(aimSpace3d(VP, 'p'))!;
  [[0, 0], [200, 0], [200, 100], [0, 100]].forEach(([x, y], i) => {
    expect(out[i]!.x).toBeCloseTo(x!, 6);
    expect(out[i]!.y).toBeCloseTo(y!, 6);
  });
});
it('outlines its footprint on z = 0 in a 2D space', () => {
  const out = aimOf3d(VP, 'p').outlineIn(FLAT)!;
  const xs = out.map((p) => p.x), ys = out.map((p) => p.y);
  expect(Math.min(...xs)).toBeCloseTo(-8.2843, 3); expect(Math.max(...xs)).toBeCloseTo(8.2843, 3);
  expect(Math.min(...ys)).toBeCloseTo(-4.1421, 3); expect(Math.max(...ys)).toBeCloseTo(4.1421, 3);
});
it('answers null in a 2D space behind it', () => {
  const away = { ...VP, camera: createCamera({ target: { x: 0, y: 0, z: -40 } }) }; // eye z = -30, looking toward -z
  expect(aimOf3d(away, 'p').outlineIn(FLAT)).toBeNull();
});
it('pans its camera target by the world distance in a 2D space', () => {
  const moved = aimOf3d(VP, 'p').pannedIn(FLAT, { x: 0, y: 0 }, { x: 1, y: 0 }) as Aim3d;
  expect(cameraOfAim3d(moved).target).toEqual({ x: 1, y: 0, z: 0 });
});
it('names the view it was read in', () => {
  expect(aimOf3d(VP, 'p').viewId).toBe('p');
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run --project=weasel-ui packages/kernel3d/src/aim.test.ts`
Expected: FAIL with `Cannot find module './aim'`.

- [ ] **Step 3: Implement `aim.ts`** to the interfaces above. The frustum's corners lie on the `rayAt` rays through the four pane corners, at the `near` and `far` depths measured along the camera's forward axis.

- [ ] **Step 4: Run the test and confirm it passes**

Same command. Expected: PASS.

- [ ] **Step 5: Export** `aimOf3d`, `aimSpace3d`, `cameraOfAim3d`, `type Aim3d` and `type Frustum3d` from `packages/kernel3d/src/index.ts`.

- [ ] **Step 6: Commit and verify on the fleet**

```bash
git add packages/kernel3d/src/aim.ts packages/kernel3d/src/aim.test.ts packages/kernel3d/src/index.ts
git commit -m "answer a frustum aim for a kernel3d camera"
npm run test:fleet -- HEAD
```

Expected: the log has `fleet-tree: N changed path(s) match <sha>`, the gate project passes (typecheck, `check:imports`, `check:size`), and nothing fails.

---

### Task 3: The held side — `<CanvasView aim>`, and aims answered and written for every view

**Files:**
- Create: `packages/core/src/canvas/useViewAim.ts`
- Modify:
  - `packages/core/src/canvas/canvasViewProps.ts`: split `CanvasViewProps` into common props and `CameraHeldViewProps | AimHeldViewProps`.
  - `packages/core/src/canvas/useCanvasView.ts`: add `CanvasViewOptions.controlledBy?: 'view' | 'aim'`. It changes only the wording of the controlled-write warning.
  - `packages/core/src/canvas/CanvasView.tsx`: replace the `useCanvasView({...})` call (:105-118) with `useViewAim(...)`, which makes that call, and add `held` / `aim` / `setAim` to the registration (:255-300). The function must stay at or under its allow-listed 249 lines.
  - `packages/core/src/canvas/viewRegistry.tsx`: add `ViewRegistration.held`, `.aim()` and `.setAim()`; `SurfaceHandle.setView?`; and `ViewRegistry.aimOf()` and `.setAim()`.
  - `packages/core/src/canvas/useViewRegistrySurface.ts` and `Canvas.tsx` (:83-86, :120): pass `viewState.setViewFromInput` as the handle's `setView`.
  - `packages/core/src/canvas/canvasExtension.ts`: add `SceneCanvasApi.aimOf` and `.setAim` after `viewAt` (:245).
  - `packages/core/src/canvas/SceneCanvas/useSceneCanvasHandle.ts`: `useAddedViews` returns `aimOf` / `setAim` over the registry, and `useSceneCanvasHandle` puts them on the handle. `SceneCanvas.tsx` (:117, :121-122) threads them through.
- Test: `packages/core/src/canvas/CanvasView.aim.test.tsx`, `packages/core/src/canvas/SceneCanvas.aims.test.tsx`

**Interfaces:**
- Consumes: Task 1's `rectAim`, `isRectAim`, `viewForAim` and `ViewAim`; core's `viewportWorldRect`.
- Produces:

```ts
// canvasViewProps.ts
export interface CameraHeldViewProps {
  view?: View | ((outer: View, dims: Dims) => View); defaultView?: View; onViewChange?: (v: View) => void; viewBounds?: Bounds;
  aim?: never; onAimChange?: never;
}
export interface AimHeldViewProps {
  /** What the view shows, as a world rect; its camera fits it to the frame, uniformly and centered.
   *  A thunk is read at each paint and event, measured like a thunked `view`. */
  aim: Bounds | ((outer: View, dims: Dims) => Bounds);
  /** A pan or zoom inside the view, or `setAim` on it, reported as the rect the view would then show. */
  onAimChange?: (aim: Bounds) => void;
  view?: never; defaultView?: never; onViewChange?: never; viewBounds?: never;
}
export type CanvasViewProps = CanvasViewCommonProps & (CameraHeldViewProps | AimHeldViewProps);

// viewRegistry.tsx (all @internal)
interface ViewRegistration { …; held: 'camera' | 'aim'; aim(): ViewAim; setAim(aim: ViewAim): boolean }
interface SurfaceHandle { …; setView?(next: View): void }
interface ViewRegistry { …; aimOf(id: string | null): ViewAim | null; setAim(id: string | null, aim: ViewAim): boolean }

// canvasExtension.ts, on SceneCanvasApi (public)
/** What view `id` shows (`null`: the canvas's own camera), or `null` while no such view is mounted. */
aimOf(id: string | null): ViewAim | null;
/** Point view `id` at `aim`. A camera-held view moves its camera; an aim-held one reports the aim through
 *  `onAimChange`. `false` when there is no such view, the aim is not one it can read, or the canvas has no
 *  camera writer. */
setAim(id: string | null, aim: ViewAim): boolean;

// useViewAim.ts
export function useViewAim(args: {
  props: Pick<CanvasViewProps, 'view' | 'defaultView' | 'onViewChange' | 'viewBounds' | 'aim' | 'onAimChange'>;
  id: string;
  registry: ViewRegistry | null;
  derivedAt: ReturnType<typeof useViewNesting>['derivedAt'];
  rectNow: () => ViewRect;
}): CanvasViewState & { held: 'camera' | 'aim'; aim(): ViewAim; setAim(aim: ViewAim): boolean };
```

How each kind of view answers and takes an aim:

| View | `aim()` | Camera | A camera write (input or `setView`) | `setAim(aim)` |
|---|---|---|---|---|
| camera-held `<CanvasView>` | `rectAim(id, viewportWorldRect(camera, frame))` | its own, as today | as today | `setViewFromInput(viewForAim(extent, frame, 'exact'))` |
| aim-held `<CanvasView>` | `rectAim(id, heldRect)` | `viewForAim(heldRect, frame, 'contain')`, through the existing `derivedAt` thunk | `onAimChange(viewportWorldRect(next, frame))` | `onAimChange(extent)` |
| root (`null`) | `rectAim(null, viewportWorldRect(surface.view(), surface.dims()))` | the canvas's | as today | `surface.setView(viewForAim(extent, dims, 'exact'))` |

Every `setAim` returns `false` for an aim that is not a `RectAim`.

- [ ] **Step 1: Write the failing held-side tests** in `CanvasView.aim.test.tsx`

These use the `Surface` harness from `CanvasView.camera.test.tsx:21-44` (300×200, `outer` at the origin) with `PANEL = { x: 0, y: 0, w: 200, h: 100 }`. Copy that file's `mount`, and add a `setOuter` and the `registry` to what it returns.

```ts
it('fits its camera to the aim it holds', () => {
  const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 } });
  expect(h.camera.current!.getView()).toEqual({ x: -15, y: 20, scale: { x: 2, y: 2 } });
});
it('answers the aim it holds, not the wider rect it shows', () => {
  const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 } });
  expect(h.registry.aimOf('panel')!.extent).toEqual({ x: 10, y: 20, width: 50, height: 50 });
});
it('follows a thunked aim measured from the outer camera', () => {
  const h = mount({ aim: (outer) => ({ x: outer.x, y: outer.y, width: 100, height: 50 }) });
  h.setOuter({ x: 40, y: 0, scale: { x: 1, y: 1 } });
  expect(h.camera.current!.getView()).toMatchObject({ x: 40, scale: { x: 2, y: 2 } });
});
it('reports a camera write as the rect it would show', () => {
  const onAimChange = vi.fn();
  const h = mount({ aim: { x: 10, y: 20, width: 50, height: 50 }, onAimChange });
  act(() => h.camera.current!.setView({ x: 0, y: 20, scale: { x: 2, y: 2 } }));
  expect(onAimChange).toHaveBeenLastCalledWith({ x: 0, y: 20, width: 100, height: 50 });
});
it("answers a camera-held view's aim from its camera", () => {
  const h = mount({ defaultView: { x: 5, y: 0, scale: { x: 0.5, y: 0.5 } } });
  expect(h.registry.aimOf('panel')!.extent).toEqual({ x: 5, y: 0, width: 400, height: 200 });
});
it('moves a camera-held view to a written aim, keeping its scale', () => {
  const h = mount({ defaultView: { x: 0, y: 0, scale: { x: 0.5, y: 0.5 } } });
  expect(h.registry.setAim('panel', rectAim('panel', { x: 30, y: 40, width: 400, height: 200 }))).toBe(true);
  expect(h.camera.current!.getView()).toEqual({ x: 30, y: 40, scale: { x: 0.5, y: 0.5 } });
});
it('refuses an aim it cannot read', () => {
  const h = mount({});
  expect(h.registry.setAim('panel', { ...rectAim('panel', { x: 0, y: 0, width: 1, height: 1 }), kind: 'frustum' })).toBe(false);
});
```

Also add a type test: a `// @ts-expect-error` on `<CanvasView id="x" bounds={PANEL} aim={…} view={…} />`.

- [ ] **Step 2: Write the failing surface tests** in `SceneCanvas.aims.test.tsx`

The fixture mounts `<SceneCanvas scene layers={{}} width={400} height={300} view={ROOT} onViewChange={onViewChange} ref={api}>` around `<CanvasView id="pip" bounds={{ x: 250, y: 180, w: 140, h: 105 }} defaultView={{ x: 0, y: 0, scale: { x: 0.25, y: 0.25 } }} />`, with the stubs from `packages/minimap/src/minimap.test.tsx:33-45`.

```ts
it("answers the root view's aim", () => {
  expect(api.current!.aimOf(null)!.extent).toEqual({ x: 0, y: 0, width: 400, height: 300 });
  expect(api.current!.aimOf(null)!.viewId).toBeNull();
});
it("answers a view's aim, and null for no such view", () => {
  expect(api.current!.aimOf('pip')!.extent).toEqual({ x: 0, y: 0, width: 560, height: 420 });
  expect(api.current!.aimOf('nope')).toBeNull();
});
it('writes the root aim through onViewChange', () => {
  act(() => { api.current!.setAim(null, rectAim(null, { x: 40, y: 40, width: 400, height: 300 })); });
  expect(onViewChange).toHaveBeenLastCalledWith({ x: 40, y: 40, scale: { x: 1, y: 1 } });
});
```

- [ ] **Step 3: Run both tests and confirm they fail**

Run: `npx vitest run --project=core packages/core/src/canvas/CanvasView.aim.test.tsx`, then `npx vitest run --project=core packages/core/src/canvas/SceneCanvas.aims.test.tsx`
Expected: FAIL on the `getView` and `aimOf` assertions. Vitest does not report type errors, so the `aim` prop failing to type-check shows up only on the fleet.

- [ ] **Step 4: Implement** to the Interfaces block. `useViewAim` takes over the `useCanvasView` call that `CanvasView.tsx:105-118` makes now, so the component gets shorter, not longer. In `useCanvasView`, `controlledBy: 'aim'` makes the warning name `aim` / `onAimChange` instead of `view` / `onViewChange`.

- [ ] **Step 5: Run the new tests and the suites they touch, and confirm they pass**

One at a time:

```
npx vitest run --project=core packages/core/src/canvas/CanvasView.aim.test.tsx
npx vitest run --project=core packages/core/src/canvas/SceneCanvas.aims.test.tsx
npx vitest run --project=core packages/core/src/canvas/CanvasView.camera.test.tsx
npx vitest run --project=core packages/core/src/canvas/CanvasView.nested.test.tsx
npx vitest run --project=core packages/core/src/canvas/Canvas.viewRegistry.test.tsx
```

Expected: all PASS.

- [ ] **Step 6: Commit and verify on the fleet**

```bash
git add packages/core/src/canvas
git commit -m "let a CanvasView hold its aim, and answer and write aims for every view"
npm run test:fleet -- HEAD
```

Expected: the log has `fleet-tree: N changed path(s) match <sha>`, the gate passes (the typecheck sees the `@ts-expect-error`, and `check:size` holds the 249-line ceiling), and nothing fails.

---

### Task 4: Markers — declared, registered and painted

**Files:**
- Create: `packages/core/src/features/viewports/viewMarker.ts`, `packages/core/src/canvas/ViewMarker.tsx`, `packages/core/src/canvas/SceneCanvas/SurfaceDeclarations.tsx`
- Modify:
  - `packages/core/src/canvas/viewRegistry.tsx`: add `registerMarker` and `markerLayers`.
  - `packages/core/src/canvas/CanvasView.tsx`: the viewport layer's `source` (:268) becomes `() => [...drawnLayers(), ...(registry?.markerLayers(id) ?? [])]`. `drawnLayers` itself is unchanged, so a view nested in this one doesn't paint its parent's markers.
  - `packages/core/src/canvas/useLayerStack.ts:72-74`: root markers go between the slot layers and the views, as `[...layers, ...viewRegistry.markerLayers(null), ...views]`.
  - `packages/core/src/canvas/surfaceContribution.ts:41`: add `markers?: readonly ViewMarkerProps[]`, and make `mergeContributions` throw on a duplicate marker id, as it does for views.
  - `packages/core/src/canvas/SceneCanvas.tsx:160-164`: replace with `<SurfaceDeclarations views={props.views} entries={contributionEntries(tools.tools)} added={addedViews} />`.
  - `packages/core/src/barrel/viewport.ts:111`: export `ViewMarker` and its types by name.
- Test: `packages/core/src/features/viewports/viewMarker.test.ts`, `packages/core/src/canvas/ViewMarker.test.tsx`, `packages/core/src/canvas/Canvas.layerStack.test.tsx`

**Interfaces:**
- Consumes: Task 1's `ViewAim`, `AimSpace` and `aimSpace2d`; Task 3's `ViewRegistry.aimOf` and `.setAim`, and the registrations' `layer.resolvable`.
- Produces:

```ts
// viewMarker.ts
/** An aim handed in by value (another surface's view, a 3D pane), with the writer that moves it. */
export interface AimSource { aim(): ViewAim | null; setAim?(aim: ViewAim): void }
export interface ViewMarkerStyle { stroke?: string; width?: number; dash?: readonly number[] }
export interface ViewMarkerProps {
  /** Unique among the markers on one surface. */
  id: string;
  /** Whose aim: a view id on this surface, `null` for the root view, or an aim by value. */
  source: string | null | AimSource;
  /** Whose frame it is drawn in, after that view's layers: a view id, or `null` for the root. */
  target: string | null;
  /** Screen px. Default: stroke `#ffffff`, width 1, dash [2, 3]. */
  style?: ViewMarkerStyle;
  /** Default true: dragging the marker edits the source's aim. A source with no writer is never interactive. */
  interactive?: boolean;
}
export const VIEW_MARKER_DEFAULT_STYLE: Required<ViewMarkerStyle>;
/** What a marker resolves aims through: the surface's views. */
export interface ViewMarkerHost {
  aimOf(id: string | null): ViewAim | null;
  setAim(id: string | null, aim: ViewAim): boolean;
}
/** A screen-space layer, id `view-marker:<id>`, drawing `props`'s source aim in the frame it is handed. */
export function createViewMarkerLayer(props: () => ViewMarkerProps, host: ViewMarkerHost): RenderLayer<unknown>;

// viewRegistry.tsx (@internal)
registerMarker(props: () => ViewMarkerProps): () => void;
/** The layers of the markers drawn in `target`'s frame, in mount order. */
markerLayers(target: string | null): readonly RenderLayer<unknown>[];

// ViewMarker.tsx
/** Draws one view's aim inside another's frame. Renders nothing; outside a surface it is inert. */
export function ViewMarker(props: ViewMarkerProps): null;
```

The layer's `draw(data, view, dims)`:
1. builds `aimSpace2d(target, view, dims)`;
2. resolves the source: an id or `null` through `host.aimOf`, an `AimSource` through `.aim()`;
3. emits one stroke-only `path` command in screen px: `polygonFromPoints` (`@weasel-js/geom`) of `outlineIn(space)`.

It emits nothing when the source resolves to `null`, the outline is `null`, or the source id equals the target.

`<ViewMarker>` registers on mount through a `useLatest` thunk, so a prop change needs no re-register. After every commit it calls `registry.surface()?.requestRedraw()`, as `CanvasView.tsx` does at its end.

- [ ] **Step 1: Write the failing layer tests** in `viewMarker.test.ts`

The stub host's `aimOf(null)` is `rectAim(null, { x: 0, y: 0, width: 400, height: 300 })`. Each layer is drawn with `view = { x: 0, y: 0, scale: { x: 0.25, y: 0.25 } }` and `dims = { width: 140, height: 105 }`.

```ts
it('draws the source aim in the frame it is handed', () => {
  const [cmd] = createViewMarkerLayer(() => ({ id: 'm', source: null, target: 'pip' }), host).draw({}, view, dims) as PathDrawCommand[];
  expect(cmd!.path).toEqual(polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 75 }, { x: 0, y: 75 }]));
  expect(cmd!.stroke).toMatchObject({ paint: { kind: 'solid', color: '#ffffff' }, width: 1, dash: [2, 3] });
  expect(cmd!.fill).toBeUndefined();
});
it('is a screen-space layer named for its marker', () => {
  expect(createViewMarkerLayer(() => ({ id: 'm', source: null, target: 'pip' }), host))
    .toMatchObject({ id: 'view-marker:m', space: 'screen' });
});
it('draws an aim handed in by value', () => {
  const source = { aim: () => rectAim(null, { x: 0, y: 0, width: 400, height: 300 }) };
  const [cmd] = createViewMarkerLayer(() => ({ id: 'm', source, target: 'pip' }), host).draw({}, view, dims) as PathDrawCommand[];
  expect(cmd!.path).toEqual(polygonFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 75 }, { x: 0, y: 75 }]));
});
// Review Focus
it('draws nothing for a source with no view, or a source that is its own target', () => {
  expect(createViewMarkerLayer(() => ({ id: 'm', source: 'gone', target: 'pip' }), host).draw({}, view, dims)).toEqual([]);
  expect(createViewMarkerLayer(() => ({ id: 'm', source: 'pip', target: 'pip' }), host).draw({}, view, dims)).toEqual([]);
});
```

Match the expected `path` to `polygonFromPoints`'s actual signature in `packages/geom/src/paths/builder.ts`.

- [ ] **Step 2: Write the failing surface tests** in `ViewMarker.test.tsx`

These use Task 3's surface: root 400×300 at `ROOT`, and `pip` at `{ x: 250, y: 180, w: 140, h: 105 }` with scale 0.25.

| Test | Setup | Assertion |
|---|---|---|
| paints in its target view, after the view's own layers | `pip` added through `api.addView({ …, paint: false })`, so its handle can be drawn directly; a `<ViewMarker id="m" source={null} target="pip" />` | `handle.draw({}, ROOT, { width: 400, height: 300 })[0].children.at(-1)` matches `{ kind: 'path', stroke: { width: 1 } }` |
| does not paint in a view nested in its target | also `<CanvasView id="inner" parent="pip" …/>`, added the same way | the inner handle's draw contains no path with the marker's stroke |
| mounts before its target view (Review Focus) | the marker renders before `pip` is added | no throw; once `pip` is added, its draw ends with the marker path |
| is installed by a contribution's `markers` | `ambient={[{ id: 'c', markers: [{ id: 'm', source: null, target: 'pip' }] }]}` | the `pip` draw ends with the marker path |
| rejects a duplicate marker id | `mergeContributions([{ id: 'a', markers: [m] }], [{ id: 'b', markers: [m] }])` | throws `/marker "m"/` |

In `packages/core/src/canvas/Canvas.layerStack.test.tsx`, wrap the `<Canvas>` in a `<ViewRegistryProvider>` holding a root marker and a view, and add:

```ts
it('paints root markers above the slot layers and beneath the views', async () => {
  expect(await stackOf(/* … */)).toEqual([/* slot layers */, 'view-marker:m', 'pip', 'painted-cursor']);
});
```

- [ ] **Step 3: Run each test and confirm it fails**

```
npx vitest run --project=core packages/core/src/features/viewports/viewMarker.test.ts
npx vitest run --project=core packages/core/src/canvas/ViewMarker.test.tsx
npx vitest run --project=core packages/core/src/canvas/Canvas.layerStack.test.tsx
```

Expected: FAIL on the missing modules and on the missing `view-marker:m` id.

- [ ] **Step 4: Implement** to the Interfaces block. `SurfaceDeclarations` renders, in this order:
  1. `props.views`, as today (`order={v.order ?? i}`);
  2. contribution views;
  3. added views;
  4. each contribution's `markers`, as `<ViewMarker key={`contribution:${m.id}`} …/>`.

- [ ] **Step 5: Run each test and confirm it passes**

Run the three tests above, then `SceneCanvas.contributions.test.tsx` and `CanvasView.test.tsx`, one at a time. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src
git commit -m "draw one view's aim inside another's frame as a view marker"
```

---

### Task 5: Dragging a marker edits its source's aim

**Files:**
- Create: `packages/core/src/features/viewports/viewMarkerDrag.ts`
- Modify:
  - `packages/core/src/features/viewports/viewMarker.ts`: add `grabViewMarker`.
  - `packages/core/src/canvas/viewRegistry.tsx`: add `markerAt`.
  - `packages/core/src/canvas/CanvasView.tsx`: its `affordanceAt` (:215-224) asks `registry.markerAt(id, world)` after the registered-layer refusal and before the chrome.
  - `packages/core/src/canvas/SceneCanvas/useSceneGestureDispatcher.ts:150-152`: the root's `affordanceAt` asks `viewRegistry.markerAt(null, worldPoint)` after `hitTestExtras` and before the chrome.
  - `packages/core/src/canvas/SceneCanvas/useCanvasTools.ts:92-98`: the memoized `createViewMarkerContribution()` always joins `mergedAmbient`, as `pressFeedback` does.
- Test: `packages/core/src/features/viewports/viewMarker.test.ts` (the grab cases), `packages/core/src/canvas/ViewMarker.drag.test.tsx`

**Interfaces:**
- Consumes:
  - Task 4's `ViewMarkerProps`, `ViewMarkerHost` and `registerMarker`, and Task 3's `setAim`;
  - `layerAffordance` (`canvas/affordanceAt.ts:203`);
  - `hitPredicate`, re-exported through core's `interactions/gestures/spec.ts`.
- Produces:

```ts
// viewMarker.ts
/** A press on a marker, held for the drag: where it started, and the aim it started from. */
export interface ViewMarkerGrab { readonly markerId: string; moveTo(world: { x: number; y: number }): void }
/** A press this many screen px outside the outline still counts. */
export const VIEW_MARKER_HIT_SLOP_PX = 4;
/** The grab for a press at frame px `at`, or null when the marker is not interactive, has no writer, or is not under `at`. */
export function grabViewMarker(props: ViewMarkerProps, host: ViewMarkerHost, space: AimSpace, at: { x: number; y: number }): ViewMarkerGrab | null;

// viewRegistry.tsx (@internal)
/** The topmost interactive marker drawn in `target` under `world` (a point in `target`'s world), as the affordance a press there routes. */
markerAt(target: string | null, world: { x: number; y: number }): AffordanceHit | null;

// viewMarkerDrag.ts
export const VIEW_MARKER_DRAG = 'view.marker.drag';
/** Drags the grabbed marker. There is nothing to commit, so a cancel ends where a release does. */
export function viewMarkerDragAction(): Action;
/** The always-on entry (id 'view-marker') that binds a drag on any marker to `view.marker.drag`. */
export function createViewMarkerContribution(): SurfaceContribution;
```

How the pieces work:

- **`grabViewMarker`** keeps the press point `at` and the source's aim at press time. `moveTo(world)` writes `startAim.pannedIn(space, at, space.project(world))` through `host.setAim`, or through the `AimSource`'s own `setAim`. The move is measured from the press rather than from the last move, so the drag threshold loses nothing.
- **`markerAt`** builds the target's `AimSpace` from the registry: for the root, from `surface.view()` and `dims()`; for a view, from its `layer.resolvable(outer, dims)` camera and rect size. It walks that target's markers topmost first and returns `layerAffordance(`view-marker:${id}`, { initialScratch: grab })`.
- **The binding** is `{ spec: { kind: 'drag', target: { kindOf: hitPredicate((hit) => hit.kind.startsWith('layer:view-marker:')) } }, actionId: VIEW_MARKER_DRAG, opts: { id: 'view-marker.drag' } }`.
- **The action** reads its grab from the hit's payload, the way `hud.drag` reads its widget (`packages/hud/src/tool.ts`), and calls `moveTo(m.drag?.current ?? m.world)` on each move.

- [ ] **Step 1: Write the failing grab tests** in `viewMarker.test.ts`

These reuse Task 4's host, view and dims; `space` is `aimSpace2d('pip', view, dims)` and `R` is the 400×300 root rect.

```ts
it('grabs inside the outline, and within the slop outside it', () => {
  expect(grabViewMarker(props, host, space, { x: 50, y: 40 })).not.toBeNull();
  expect(grabViewMarker(props, host, space, { x: 103, y: 40 })).not.toBeNull();
  expect(grabViewMarker(props, host, space, { x: 110, y: 40 })).toBeNull();
});
it('moves the source by the world distance from the press', () => {
  grabViewMarker(props, host, space, { x: 50, y: 20 })!.moveTo({ x: 240, y: 120 }); // frame (60, 30)
  expect(host.setAim).toHaveBeenLastCalledWith(null, expect.objectContaining({ extent: { x: 40, y: 40, width: 400, height: 300 } }));
});
// Review Focus
it('does not grab a source with no writer, or a marker that is not interactive', () => {
  expect(grabViewMarker({ ...props, source: { aim: () => rectAim(null, R) } }, host, space, { x: 50, y: 40 })).toBeNull();
  expect(grabViewMarker({ ...props, interactive: false }, host, space, { x: 50, y: 40 })).toBeNull();
});
```

- [ ] **Step 2: Write the failing end-to-end tests** in `ViewMarker.drag.test.tsx`

This file is the arc's "done when". Take the stubs and `pointer()` from `packages/minimap/src/minimap.test.tsx:33-52`, and import nothing from the minimap anywhere in it.

```tsx
function mount(extra: Partial<SceneCanvasProps<D, 'main', P>> = {}) {
  render(
    <SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} onViewChange={onViewChange} ref={api} {...extra}>
      <CanvasView id="pip" bounds={{ x: 250, y: 180, w: 140, h: 105 }} defaultView={{ x: 0, y: 0, scale: { x: 0.25, y: 0.25 } }} cameraRef={pip} />
      <ViewMarker id="root-aim" source={null} target="pip" />
    </SceneCanvas>,
  );
}
const drag = (from: [number, number], to: [number, number]) => act(() => {
  pointer(canvas, 'pointerdown', ...from);
  pointer(canvas, 'pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  pointer(canvas, 'pointermove', ...to);
  pointer(canvas, 'pointerup', ...to);
});
it('pans the root camera when the marker is dragged in the PiP', () => {
  mount();
  drag([300, 200], [310, 210]);
  expect(last(onViewChange)).toMatchObject({ x: 40, y: 40, scale: { x: 1, y: 1 } });
  expect(pip.current!.getView()).toEqual({ x: 0, y: 0, scale: { x: 0.25, y: 0.25 } });
});
it('leaves the root alone for a drag in the PiP outside the marker', () => {
  mount();
  drag([370, 270], [380, 275]);
  expect(onViewChange).not.toHaveBeenCalled();
});
it('keeps following a drag that leaves the PiP', () => {
  mount();
  drag([300, 200], [100, 100]);
  expect(last(onViewChange)).toMatchObject({ x: -800, y: -400 });
});
// Review Focus
it('wins over the select tool on a draw surface', () => {
  mount({ features: ['draw'] });
  drag([300, 200], [310, 210]);
  expect(last(onViewChange)).toMatchObject({ x: 40, y: 40 });
  // and the surface's selection is still empty
});
it('reaches onViewChange clamped by viewBounds', () => {
  mount({ viewBounds: { x: 0, y: 0, width: 420, height: 320 } });
  drag([300, 200], [310, 210]);
  expect(last(onViewChange)).toMatchObject({ x: 20, y: 20 });
});
it('ends a camera glide in flight', () => {
  mount();
  act(() => api.current!.animateView({ x: 500, y: 0, scale: { x: 1, y: 1 } }));
  drag([300, 200], [310, 210]);
  expect(api.current!.isViewAnimating()).toBe(false);
});
it("marks a PiP's aim in the root view and drags the PiP's camera", () => {
  // add <ViewMarker id="pip-aim" source="pip" target={null} />: the PiP shows world (0,0)–(560,420)
  drag([20, 20], [30, 20]);
  expect(pip.current!.getView()).toMatchObject({ x: 10, y: 0 });
});
```

- [ ] **Step 3: Run each test and confirm it fails**

```
npx vitest run --project=core packages/core/src/features/viewports/viewMarker.test.ts
npx vitest run --project=core packages/core/src/canvas/ViewMarker.drag.test.tsx
```

Expected: FAIL. Nothing grabs the marker, and `onViewChange` is never called.

- [ ] **Step 4: Implement** to the Interfaces block. Export `VIEW_MARKER_DRAG`, `viewMarkerDragAction`, `VIEW_MARKER_HIT_SLOP_PX` and the `ViewMarkerGrab` type by name from `features/viewports/index.ts`. `createViewMarkerContribution` stays internal to core.

- [ ] **Step 5: Run each test and the suites it touches, and confirm they pass**

The ambient list and both `affordanceAt`s changed, so also run these, one at a time:
- `SceneCanvas.layerClaim.test.tsx`, `SceneCanvas.contributions.test.tsx` and `perViewRouting.test.tsx` (`--project=core`);
- `packages/minimap/src/minimap.test.tsx` (`--project=weasel-ui`).

Expected: PASS.

- [ ] **Step 6: Commit and verify on the fleet**

```bash
git add packages/core/src
git commit -m "drag a view marker to move the view whose aim it draws"
npm run test:fleet -- HEAD
```

Expected: the log has `fleet-tree: N changed path(s) match <sha>`, the gate passes, and nothing fails.

---

### Task 6: Docs, changesets, the design doc, and merge

**Files:**
- Modify: `packages/core/src/features/viewports/README.md`, `packages/kernel3d/README.md`, `docs/TODO.md`, `docs/superpowers/specs/2026-10-21-lens-views-design.md`
- Create: `.changeset/view-aims-and-markers.md`
- Delete: this plan, `docs/superpowers/plans/2026-10-21-view-aims-and-markers.md`

- [ ] **Step 1: Update the READMEs**

`features/viewports/README.md` gains a section, "Aims, held side and markers", covering:
- what an aim is, in one paragraph naming `ViewAim`, `aimSpace2d` and the `z = 0` convention;
- the `aim` / `onAimChange` form of `<CanvasView>`;
- `SceneCanvasApi.aimOf` / `setAim`;
- `<ViewMarker>` and `SurfaceContribution.markers`, with the drag.

`kernel3d/README.md` gains a short "Aims" section for `aimOf3d`, `aimSpace3d` and `cameraOfAim3d`. Do a cut pass on both before committing.

- [ ] **Step 2: Write the changeset**, `patch` for both packages:

```md
---
'@weasel-js/core': patch
'@weasel-js/kernel3d': patch
---

Views answer what they show: `SceneCanvasApi.aimOf` and `setAim`, and `<CanvasView aim onAimChange>` for a view that holds its aim and derives its camera from it. `<ViewMarker>`, or a contribution's `markers`, draws one view's aim inside another's frame, and dragging the marker moves that view. kernel3d answers a frustum aim with `aimOf3d`.

`CanvasViewProps` is now a union: `aim` cannot be passed together with `view`, `defaultView`, `onViewChange` or `viewBounds`. Code that writes an interface extending `CanvasViewProps` needs a type alias instead.
```

- [ ] **Step 3: Cut the design doc down to arcs 2–3**

Rewrite `2026-10-21-lens-views-design.md` so it covers only the unbuilt arcs:
- The status line becomes "Arc 1 built 2026-10-21 (core aims, held side, markers; kernel3d aims): see `packages/core/src/features/viewports/README.md`. Arcs 2–3 unbuilt."
- Cut the Arc 1 section, and the "Left to the builder" lines that only arc 1 answered.
- Where arcs 2–3 say "arc 1", name what shipped instead: `<CanvasView aim>`, `ViewMarker`, `SurfaceContribution.markers`, `aimOf3d`.
- Keep Terms, Decisions, Anti-goals and Constraints.

- [ ] **Step 4: Add the TODO entries** to `docs/TODO.md`, under Viewport:
  - (P3) kernel3d's frustum outlines into a 2D view only as its footprint on z = 0. In kernel3d's y-up world that plane is a wall facing yaw 0, but a top-down map wants the ground plane. Decide which plane 2D and 3D views share before building a 3D minimap.
  - (P3) A `tools` takeover drops the always-on marker entry, so markers stop dragging. Long-press feedback has the same gap.

- [ ] **Step 5: Verify the branch on the fleet**

```bash
npm run test:fleet -- HEAD
npm run test:fleet:postbuild -- HEAD
```

Expected: each log has `fleet-tree: N changed path(s) match <sha>`, and the gate passes. The postbuild run's consumer smokes pass too; a `No matching export` there means a new barrel name slipped through as an `export *` of another workspace package.

- [ ] **Step 6: Commit, merge, and verify main**

In the worktree:

```bash
git add packages/core/src/features/viewports/README.md packages/kernel3d/README.md docs .changeset
git rm docs/superpowers/plans/2026-10-21-view-aims-and-markers.md
git commit -m "document view aims and markers, and cut the lens-views design to arcs 2-3"
```

Then leave the worktree with `ExitWorktree` (`keep`), and from the main checkout:

```bash
git merge --ff-only feat/view-aims   # rebase the branch onto main first if main has moved
npm run test:fleet -- main           # start it in the background and carry on
git worktree remove .claude/worktrees/view-aims && git branch -d feat/view-aims
```

Expected: the run on `main` is green. If it fails, the failure is the next task.
