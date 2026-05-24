# Curve Representations Lab Demo

## Problem

The kit stores 2D paths as cubic Bezier polygons because that's what every downstream pipeline (PDF, SVG, browser canvas, OpenType) speaks. But that choice — and the trade-offs against alternatives like NURBS, quadratic Bezier, and κ-curves (Spiro) — isn't taught anywhere in the codebase. New consumers reading the kit can't see *why* cubic Bezier is the storage format, what its limitations are, or where other representations would shine.

A lab demo that renders the same anchor set in all four representations side-by-side, with curvature overlays and editable discriminators, would answer those questions visually and serve as a stress test for the path-edit + alt-click-insert UX across representations.

## Goals

- **Teach**: a reader of the demo learns Bezier vs NURBS vs quadratic vs Spiro by adjusting one input and watching all four outputs.
- **Surface trade-offs visually**: where the curves diverge (sharp corners, near-circles, inflection points) becomes obvious without numerical literacy.
- **Reuse-ready math**: the curve representations land as a tested library (`src/features/paths/curves/`) the kit can later use for non-demo features (Spiro-driven smoothing tool, NURBS-backed circle primitives).
- **Stress-test path edit + alt-click insert** across representations to surface any kit assumptions baked into the cubic-Bezier path.

## Non-goals

- Replacing cubic Bezier as the kit's storage format. The shared anchor set is the source of truth; the other three representations are *projections* for visualization.
- Production-grade curve fitting (Adobe-quality auto-corner detection, kerning awareness, etc.).
- 3D NURBS surfaces. Strictly 2D curves.
- A v1 with every UI polish. Library + functional demo first; visual polish iterates.

## Architecture

A **library-first** layout: the math lives in `src/features/paths/curves/` with per-representation unit tests; the demo (`demo/demos/CurveLabDemo.tsx` and `demo/demos/curveLab/`) is UI composing the library.

```
src/features/paths/curves/
  index.ts            // Public exports
  types.ts            // SharedAnchor, CurveRepKind, CurveRepresentation, Discriminator
  bezierCubic.ts      // Adapter over existing pathToAnchors / anchorsToPath
  bezierCubic.test.ts
  bezierQuadratic.ts  // Degree reduction from cubic; midpoint approximation
  bezierQuadratic.test.ts
  nurbs.ts            // Cubic NURBS, uniform knots, per-anchor weights, de Boor evaluation
  nurbs.test.ts
  spiro.ts            // Raph Levien's Spiro solver adapted; outputs cubic approximants
  spiro.test.ts
  curvature.ts        // Generic curvatureAt() via finite differences; per-rep overrides
  curvature.test.ts
  curve-conformance.test.ts  // Shared fixtures across all four reps

demo/demos/CurveLabDemo.tsx              // Top-level: shared state, panel grid, controls
demo/demos/curveLab/
  presets.ts          // Five seeded SharedAnchor[] configs
  overlays.ts         // Overlay layer factories (anchors, curvature comb, inflections, readout)
  RepresentationPanel.tsx                // One of four panels — its own SceneCanvas
  ReadoutHud.tsx                         // Numerical stats panel
```

### `SharedAnchor` — the single source of truth

```ts
interface SharedAnchor {
  x: number;
  y: number;
  /** Cubic-Bezier-only: hand-positioned tangent handles. Bezier* reps read these;
   *  NURBS and Spiro ignore. */
  inHandle?: { x: number; y: number };
  outHandle?: { x: number; y: number };
  /** NURBS-only: rational weight. 1 = standard B-spline; default 1; clamped ≥ 1e-3. */
  weight?: number;
  /** Spiro-only: corner / smooth-G²/G⁴ classification. Default `'g2-smooth'`. */
  spiroType?: 'corner' | 'g2-smooth' | 'g4-smooth';
}
```

Every panel reads from the same `SharedAnchor[]` array. Panels can't drift because there is no per-panel path state — `toPath()` is recomputed on every render.

### `CurveRepresentation` interface

```ts
interface CurveRepresentation {
  kind: 'bezierCubic' | 'bezierQuadratic' | 'nurbs' | 'spiro';
  label: string;                                       // Display name
  /** Sample the curve at parameter t∈[0,1]. */
  evaluate(anchors: SharedAnchor[], t: number): { x: number; y: number };
  /** Convert anchors to a kit PolygonPath for the renderer. */
  toPath(anchors: SharedAnchor[]): PolygonPath;
  /** Signed local curvature. Drives the curvature-comb overlay. */
  curvatureAt(anchors: SharedAnchor[], t: number): number;
  /** Per-representation user controls (handle drag enable, weight sliders, type pickers).
   *  Returned as a generic Discriminator[] so RepresentationPanel can render them uniformly. */
  discriminators(anchors: SharedAnchor[]): Discriminator[];
}

type Discriminator =
  | { kind: 'slider'; label: string; anchorIndex: number; field: string;
      min: number; max: number; step: number; value: number }
  | { kind: 'enum'; label: string; anchorIndex: number; field: string;
      options: readonly string[]; value: string }
  | { kind: 'handle'; anchorIndex: number; which: 'in' | 'out' };  // exposed only for Bezier
```

## Components

### Library

- **`bezierCubic.ts`** — wraps existing `pathToAnchors` / `anchorsToPath`. Discriminators expose `inHandle`/`outHandle` for direct drag.
- **`bezierQuadratic.ts`** — converts each cubic segment to a quadratic by averaging the two cubic control points (midpoint approximation). Has visible error on sharp curves — that's the teaching point. Reads `inHandle`/`outHandle` to derive each segment's quadratic control.
- **`nurbs.ts`** — degree-3 NURBS over the shared anchors with a uniform open knot vector. Per-anchor `weight` (default 1) controls the rational form. Evaluated via de Boor's algorithm; flattened to cubic Bezier for the kit's PolygonPath via uniform refinement. Discriminators: per-anchor weight slider, range [1e-3, 8].
- **`spiro.ts`** — Raph Levien's κ-curve solver. Input: anchor positions + per-anchor `spiroType`. Output: a sequence of cubic Bezier approximants. The solver guarantees G² continuity at smooth anchors, G⁴ at G⁴-tagged anchors, and tangent-only continuity at corners. Discriminators: per-anchor `spiroType` enum picker. Implementation references Levien's open-sourced solver; we port the minimal subset (no closed-curve support in v1 if it bloats the port — closed-loop preset routes through cubic Bezier when Spiro can't handle it).
- **`curvature.ts`** — generic `curvatureAt` via finite differences over `rep.evaluate`. Reps with closed-form curvature (Bezier, NURBS via the rational form) override.

### Demo

- **`CurveLabDemo.tsx`** — owns the `SharedAnchor[]` state via `useState`. Renders the preset selector dropdown, overlay-toggle checkboxes, and the 4-panel grid (CSS grid, 2×2 in default; degrades to 4×1 on narrow viewports).
- **`RepresentationPanel.tsx`** — takes `{ rep, anchors, overlays, onAnchorsChange }`. Renders its own `<SceneCanvas>` whose scene is built from `rep.toPath(anchors)`. Renders the rep's discriminators in a sidebar inside the panel. Hosts the overlay layers.
- **`presets.ts`** — five seeded `SharedAnchor[]` configs:
  1. *Smooth S-curve* — three anchors, all smooth. Baseline for "everything looks similar."
  2. *Sharp corner* — five anchors, one tagged corner. Shows Spiro/G²-aware corner handling vs Bezier needing a "broken" handle.
  3. *Near-circle* — four anchors arranged at the cardinal points of a unit circle. Shows NURBS hitting the circle exactly with weights = √2/2 at the midpoints, Bezier approximating, Spiro approximating differently.
  4. *Closed loop* — heart-shape-ish closed curve. Highlights closed-curve handling.
  5. *Mixed* — corner + smooth join, with NURBS weight variations and a Spiro G⁴ vertex.
- **`overlays.ts`** — overlay layer factories:
  - *Anchors + controls*: anchor dots; for cubic Bezier additionally the tangent handles + dots; for NURBS the control polygon + weight indicators (dot size scales with weight); for Spiro just the anchors with type-encoded shapes (square/circle/diamond for corner/G²/G⁴).
  - *Curvature comb*: sample the rep at ~64 evenly-spaced t values; at each, draw a hair perpendicular to the curve with length proportional to `curvatureAt(t)`. Scaled by a configurable factor so the comb is visible without overflowing the panel.
  - *Inflections + extrema*: sample curvature densely; mark sign changes (inflection) with a hollow ring and absolute-max points (extrema) with a filled diamond.
  - *Numerical readout*: not a layer — a HUD widget showing per-panel stats: anchor count, segment count after flattening to ε=0.5, max |curvature|, RMS curvature, arc length.
- **`ReadoutHud.tsx`** — small fixed-position panel under each `RepresentationPanel`. Reads through the same `evaluate` / `curvatureAt` calls the overlays use.

### Authoring

Pen-tool integration deferred to v1.1; v1 ships with the preset library and anchor drag only. Adding a new anchor in v1 happens via alt-click on the curve (the kit's existing `insertPathAnchorAction`) — works for the cubic Bezier panel, and the shared state propagates the new anchor to the other three.

## Data flow

```
SharedAnchor[]  (CurveLabDemo state — single source of truth)
       │
       ├──→ Panel 1: bezierCubic.toPath()      → <SceneCanvas>
       ├──→ Panel 2: bezierQuadratic.toPath()  → <SceneCanvas>
       ├──→ Panel 3: nurbs.toPath()            → <SceneCanvas>
       └──→ Panel 4: spiro.toPath()            → <SceneCanvas>
              │
              └──→ Overlay layers also read directly from
                   rep.evaluate / rep.curvatureAt / rep.discriminators
```

**Edit propagation:** all anchor edits (drag, discriminator change, preset selection) update the shared `SharedAnchor[]` state via React `setState`. Each panel re-derives `toPath()` on the next render. No sync logic between panels; representations cannot drift.

**Per-rep discriminators** mutate fields on individual `SharedAnchor` entries (`weight`, `spiroType`, `inHandle`/`outHandle`). Editing a NURBS weight visibly affects only the NURBS panel because the other reps don't read that field. Editing position affects all four.

## Testing

### Library

- Each rep has a `<rep>.test.ts` covering:
  - Evaluation at canonical `t` values (0, 0.5, 1) against hand-computed truth.
  - Curvature at known points: a flat segment has κ=0, a circle has κ=1/radius (NURBS only — exact), an inflection point has signed κ crossing zero.
  - Round-trip from anchors to path back to anchors where applicable.
- `curve-conformance.test.ts` runs a shared fixture (the *Smooth S-curve* preset) through all four reps and asserts:
  - All return non-empty `PolygonPath`.
  - Anchor count of returned path is sensible per rep (≥ shared anchor count; Spiro / NURBS may add intermediate Bezier anchors).
  - `evaluate(t=0)` equals the first shared anchor for every rep.
  - `evaluate(t=1)` equals the last shared anchor for every rep.

### Demo

- Mount test in `demo/demos/__tests__/curveLabDemo.test.tsx`: renders four canvases, switching presets updates each, dragging an anchor updates shared state and re-renders all four.
- One e2e in `tests/e2e/curve-lab.spec.ts`: load demo, select *Sharp corner* preset, drag the corner anchor in the cubic Bezier panel by (40, 0), assert all four panels' probe outputs reflect the new anchor position.

The demo registers a `window.__weaselTest.probe('curveLab')` returning the current `SharedAnchor[]` so the e2e can read shared state directly without parsing scene snapshots.

## Error handling

- **Spiro non-convergence**: catch in `spiro.toPath`. Return an empty polygon, log one warning to the trace as a `mode-switch` entry (`spiro.convergence` → `failed`), and the panel paints a "Spiro: no solution" message overlay instead of a curve. Anchors and other overlays still render so the user can adjust inputs.
- **NURBS weight = 0**: clamp to 1e-3 in the slider's `min`. Document the floor in the slider's title attribute.
- **Empty anchors**: every rep returns an empty `PolygonPath`; the panel renders no scene path, only the (empty) overlays.
- **Anchor count = 1**: every rep returns a zero-length polygon; same behavior as empty.
- **Anchor count = 2 for Spiro**: degenerate, Spiro emits a straight line; that's correct, not an error.

## Open questions

1. **Closed-loop Spiro support.** Raph Levien's solver handles closed curves but the port is larger. v1 can ship without closed-Spiro and fall back to a straight cubic Bezier closure for that preset; document the limitation in the preset's label. v1.1 lands closed-Spiro.
2. **Curvature-comb scale.** Static scale per panel or auto-fit per-panel max? Auto-fit makes comparison across panels confusing (one is 10× another's scale). Going with **single shared scale** computed from the max across all four reps; if a panel's comb overflows, the user adjusts a single "comb scale" slider in the global toolbar.
3. **NURBS knot vector exposure.** Uniform open knot vector by default. Letting the user edit the knot vector is a power-user feature; defer to v1.1 unless a preset specifically needs it to land an interesting visual.
4. **Drag-time live update granularity.** During an anchor drag, do all four reps recompute on every pointer move (60Hz)? Spiro's solver may be too slow for sub-frame budget on weak hardware. If it lags, run Spiro in a `requestIdleCallback` and show the previous Spiro path until the new one's ready; document the throttling.

## Definition of done

- `src/features/paths/curves/` ships with all four reps + curvature + conformance tests; all green.
- `demo/demos/CurveLabDemo.tsx` registered in `demo/registry.ts` under the Paths category, named "Curve representations".
- Five presets work; preset switcher updates all four panels.
- All four overlays toggle independently and render correctly in all four panels.
- Anchor drag in any panel updates the shared state and the other three panels reflect it.
- E2e covering drag-propagates-across-panels is green.
- No console errors in dev or production builds.
- Trace records Spiro non-convergence as a mode-switch entry when it happens.
