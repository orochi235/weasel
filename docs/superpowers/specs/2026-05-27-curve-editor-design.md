# CurveEditor component

## Problem

`weasel-ui` ships primitives for continuous-value editing (Slider, ToggleBar) but nothing for editing a function or path defined by control points. Use cases that need this: animation timing curves (CSS easing visualizers, motion designer tools), audio/EQ envelopes, bevel cross-sections, color ramps, any "define a function with the mouse" workflow.

A general-purpose CurveEditor lets consumers express this without each app reinventing the same SVG + drag + interpolation code.

## Scope

A single React component, scoped to `weasel-ui`'s primitives pattern (like Slider): controlled, dependency-free, opinionated rendering with CSS-var tokens for theming.

Two domains supported via a single prop:

- **1D function** (`domain='1d'`): y = f(x). The component clamps each anchor's x between its left and right neighbors during drag so the result stays a function.
- **2D path** (`domain='2d'`): arbitrary x,y polyline. No monotonicity constraints.

Both render with the same curve math (centripetal Catmull-Rom); the difference is the drag-time clamping.

## Architecture

### Component shape

```tsx
<CurveEditor
  value={controlPoints}                  // ControlPoint[]
  onChange={setControlPoints}            // every-frame preview updates
  onChangeCommit={onCommit}              // once-per-gesture, optional
  domain="1d" | "2d"
  endpoints="free" | "pinned-x" | "pinned-both"   // default 'free'
  xRange={[0, 1]}                        // model-space x extents, default [0, 1]
  yRange={[0, 1]}                        // model-space y extents, default [0, 1]
  width={number}                         // CSS pixels
  height={number}                        // CSS pixels
  showGrid?: boolean
  showAxes?: boolean
  addPointMode?: 'click-curve' | 'click-empty' | 'never'   // default 'click-curve'
  className?: string
/>

type ControlPoint = { x: number; y: number };
```

**Endpoint semantics:**
- `'free'` (default): first/last anchors behave like any other — drag and delete normally.
- `'pinned-x'`: first/last anchors' x positions are locked to `xRange[0]` / `xRange[1]`; y is editable. CSS easing convention. Can't be deleted.
- `'pinned-both'`: first/last anchors are locked at `(xRange[0], yRange[0])` and `(xRange[1], yRange[1])` — only the interior is editable. CSS cubic-bezier convention. Can't be deleted.

**Controlled.** Caller owns `value`. The component holds zero state for the curve itself — only in-flight drag state (which anchor index is being dragged, the original value array, the pointer offset). On gesture end, the drag state clears.

**onChange vs onChangeCommit.** Two separate callbacks for a real reason:

- `onChange(next)` fires on every drag tick — used for live preview rendering and any visual derivative the consumer wants to update in real time.
- `onChangeCommit(next, prev)` fires once per discrete user action: drag-end, add, delete. Receives both the new value and the value at gesture start. This is where consumers pipe into their history layer (see "Undo via weasel-history" below).

If `onChangeCommit` is omitted, only `onChange` fires — caller can derive commit semantics themselves, or skip undo entirely.

### File layout

```
packages/ui/src/components/CurveEditor/
├── index.ts                  # public exports: CurveEditor, ControlPoint, createSetCurveOp
├── CurveEditor.tsx           # the React component (~150-200 lines)
├── CurveEditor.module.css    # styling, CSS-var tokens for colors/sizes
├── catmullRom.ts             # pure math: sampleCentripetal, segmentSamples
├── catmullRom.test.ts        # unit tests
├── geometry.ts               # model↔plot transforms, hitTestAnchor, hitTestCurve
├── geometry.test.ts          # unit tests
├── setCurveOp.ts             # weasel-history Op factory
├── setCurveOp.test.ts        # unit tests
├── CurveEditor.test.tsx      # integration: drag, add, delete, endpoints, domain
└── CurveEditor.stories.tsx   # Storybook coverage
```

Each file under ~200 lines. Split mirrors `Slider`'s organization — pure math and pure geometry tested separately from the React component.

### Centripetal Catmull-Rom

Standard formulation (Yuksel/Schneider 2011): given four consecutive control points P0, P1, P2, P3, the segment between P1 and P2 is parameterized by t ∈ [0, 1] with knot intervals `t_{i+1} - t_i = |P_{i+1} - P_i|^α`, α = 0.5. The resulting curve passes through every control point exactly (unlike pure Bezier with handles) and avoids self-intersections / cusps that uniform Catmull-Rom produces in 2D.

**Endpoint handling.** Catmull-Rom requires a P_{-1} (before the first anchor) and a P_{n+1} (after the last) to compute tangents for the first/last segments. Standard reflection: `P_{-1} = 2*P_0 - P_1`, `P_{n+1} = 2*P_n - P_{n-1}`. This makes the first/last segments tangent to the edge from the first/second anchor (and symmetrically at the other end), which reads as natural unless the caller wants a different visual.

**Sample density.** Default 16 samples per segment. Configurable later if a consumer needs fewer (performance) or more (smoother render at high zoom); not exposed in v1.

### Rendering

SVG, three layers bottom-up:

1. Grid + axes (when `showGrid` / `showAxes` enabled). Grid is N evenly-spaced lines in each axis; axes are the two outermost lines plus tick marks.
2. The sampled curve as a single `<path d="M ... L ... L ...">`. The path is the concatenation of per-segment samples.
3. Anchor markers — one `<circle>` per control point. Filled when hovered/dragged; outlined otherwise. Pinned endpoints get a distinct visual (smaller circle or different color) so users know they're constrained.

CSS-var tokens for colors and sizes:
- `--curve-bg`, `--curve-grid`, `--curve-axis`
- `--curve-line`, `--curve-line-width`
- `--curve-anchor-fill`, `--curve-anchor-stroke`, `--curve-anchor-radius`
- `--curve-anchor-active-fill`
- `--curve-pinned-fill`

Defaults live in `CurveEditor.module.css`; consumers override per-instance via inline `style` or per-app via a global stylesheet.

### Interaction

**Drag anchor.** pointerdown on a circle → component captures the anchor index + pointer offset + snapshot of `value`. pointermove computes new (x, y) in model space and fires `onChange` with a new array where only that anchor changed. In `domain='1d'`, x is clamped between left and right neighbor x values. pointerup fires `onChangeCommit(next, prev)` and releases the drag.

**Add anchor.** Per `addPointMode`:
- `'click-curve'` (default): pointerdown within the curve-hit radius (small in screen pixels) inserts a new anchor at the closest curve point, in the correct segment slot. Begins a drag on the new anchor immediately so the user can position it precisely.
- `'click-empty'`: pointerdown on plot area (not on an existing anchor) adds an anchor at the cursor. In 1D mode, the new anchor is inserted at the array index that maintains x-sort order.
- `'never'`: only existing anchors are draggable.

**Delete anchor.** Shift+click on an existing anchor. Pinned endpoints (`'pinned-x'` / `'pinned-both'`) can't be deleted; click is a no-op. Triggers `onChangeCommit`.

**Out of scope for v1:** multi-select, group nudge, keyboard nav, snap-to-grid, undo at the component level.

### Undo via weasel-history

The component ships an Op factory so consumers can plug straight into `weasel-history`:

```ts
// packages/ui/src/components/CurveEditor/setCurveOp.ts
import { type Op } from '@weasel-js/core';
import type { ControlPoint } from './CurveEditor';

export interface SetCurveAdapter {
  setValue(next: readonly ControlPoint[]): void;
}

export interface CreateSetCurveOpArgs {
  id: string;                                    // caller's stable id for this curve
  from: readonly ControlPoint[];
  to: readonly ControlPoint[];
  label?: string;
  coalesceKey?: string;
}

export function createSetCurveOp(args: CreateSetCurveOpArgs): Op;
```

The op's `apply(adapter)` calls `adapter.setValue(to)`. `invert()` returns a mirror op with `from`/`to` swapped. The `coalesceKey` is optional — typically `setCurve:${id}` works for the "treat sequential same-curve edits within a window as one entry" behavior.

Caller's wire-up:

```tsx
const [value, setValue] = useState<ControlPoint[]>(initial);

<CurveEditor
  value={value}
  onChange={setValue}
  onChangeCommit={(to, from) => {
    history.applyOps(
      [createSetCurveOp({ id: 'easing', from, to, label: 'Edit easing curve' })],
      'Edit easing curve',
    );
  }}
  /* ... */
/>
```

Three lines. The component stays neutral about how the caller manages persistence; the op factory is opt-in.

**Why this split** (op factory + onChangeCommit, not internal history wiring): keeping the component a pure controlled input means it composes cleanly into apps that use a non-weasel history layer (Redux, Zustand, plain `useState`, etc.). The op factory is just a convenience for consumers that already use weasel-history.

## Testing

`catmullRom.test.ts` — pure math:
- Curve passes through every control point exactly (sample at t=0 of each segment equals P_{i}; sample at t=1 equals P_{i+1}).
- Centripetal parameterization on a known case (three colinear points then one offset) produces no cusps; comparison against uniform Catmull-Rom on the same input shows the uniform version has cusps where centripetal does not.
- Phantom endpoint reflection: first segment is tangent to the (P_0 → P_1) chord.
- Sample density is honored (N samples between t=0 and t=1, exclusive of endpoints to avoid duplicates).

`geometry.test.ts` — pure math:
- `modelToPlot(plotToModel(p)) === p` (transform inverses) within float epsilon.
- `hitTestAnchor` returns the nearest anchor index within radius; null when no anchor is in range.
- `hitTestCurve` returns segment index + t parameter for closest curve point; null when cursor is outside the hit radius.

`setCurveOp.test.ts` — Op contract:
- Apply mutates the adapter to the `to` value.
- Invert produces an op that restores `from`.
- coalesceKey round-trips through invert.

`CurveEditor.test.tsx` — React integration via React Testing Library:
- Rendering: N anchor circles for N control points; correct fixed positions for pinned endpoints; grid/axes appear when toggled.
- Drag fires `onChange` per move with mutated single anchor; fires `onChangeCommit` once on release with (next, prev).
- 1D drag clamps x between neighbors.
- Pinned endpoint drag clamps to the pinned axis (or both).
- Add-via-click inserts at correct array slot; new anchor begins drag immediately.
- Delete-via-shift-click removes; pinned endpoints can't be deleted.
- Add/delete each fire `onChangeCommit`.

## Risks

- **Catmull-Rom overshoot.** Centripetal reduces but doesn't eliminate overshoot — a curve can dip slightly below `min(P_i, P_{i+1})` or above `max(...)`. For animation timing this is often desired (anticipation). For uses where y must stay in `[yMin, yMax]` (e.g., audio amplitude), the consumer either clamps post-evaluation or chooses a different math (out of scope for v1; if needed, ship as a `math: 'centripetal-catmull-rom' | 'monotone-cubic'` prop later).
- **Phantom-endpoint reflection produces "natural" but not always desired tangents.** A consumer who wants flat tangents at endpoints (e.g., starts/ends "at rest") needs to either insert duplicate anchors at the endpoints (kludge) or wait for a future `endpointTangent: 'reflect' | 'flat' | 'value'` prop.
- **Tight click target on small plots.** Anchor and curve hit radii are in screen pixels; on a small plot, anchors crowd. Default radii (12px anchor, 8px curve) should be configurable later but kept hard-coded for v1.
- **High control-point counts hit SVG path complexity.** 16 samples × N segments × M anchors is fine for typical curves (< 50 anchors). Beyond ~200 anchors the SVG path string grows large; v1 doesn't address this. If a consumer hits this, switch to a canvas backend.

## Out of scope

- Evaluation helper (`curve.evalAtX(x)`, `curve.evalAtT(t)`). Easy to add later as an exported function; not needed by the editor itself.
- Selection state for anchors (multi-edit, group nudge).
- Undo/redo internal to the component (caller integrates via `onChangeCommit` + `createSetCurveOp` as documented).
- Animation playback / scrubber overlay (the editor edits the curve; running animations is a separate concern).
- Snap-to-grid.
- Keyboard navigation between anchors.
- Touch gestures beyond what pointer events provide for free (pinch-zoom into the plot, two-finger drag, etc.).

These are all reasonable v2 additions but each warrants its own design call. Starting narrow keeps the v1 surface small enough to ship in a single PR.
