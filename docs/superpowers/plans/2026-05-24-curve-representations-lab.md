# Curve Representations Lab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A lab demo that renders the same anchor set as cubic Bezier, quadratic Bezier, NURBS, and κ-curves (Spiro) side-by-side, with curvature-comb and inflection overlays, surfacing the math + trade-offs between representations.

**Architecture:** Library-first — math lives in `src/features/paths/curves/` with per-rep unit tests; the demo (`demo/demos/CurveLabDemo.tsx` + `demo/demos/curveLab/`) is UI on top. Single shared `SharedAnchor[]` state across all four panels so representations can't drift.

**Tech Stack:** React, weasel kit (`SceneCanvas`, `RenderLayer`, `PolygonPath`), TypeScript. No new runtime deps — Spiro math is ported, NURBS evaluation is from-scratch.

**Spec:** `docs/superpowers/specs/2026-05-24-curve-representations-lab-design.md`

---

## File map

**Created:**

- `src/features/paths/curves/types.ts` — `SharedAnchor`, `CurveRepKind`, `CurveRepresentation`, `Discriminator`.
- `src/features/paths/curves/bezierCubic.ts` + `.test.ts` — adapter over existing `pathToAnchors` / `anchorsToPath`.
- `src/features/paths/curves/bezierQuadratic.ts` + `.test.ts` — midpoint cubic→quadratic reduction.
- `src/features/paths/curves/nurbs.ts` + `.test.ts` — degree-3 NURBS, uniform open knots, de Boor evaluation, sampled-to-Bezier flattening.
- `src/features/paths/curves/spiro.ts` + `.test.ts` — Raph Levien's κ-curve solver port (open curves in v1).
- `src/features/paths/curves/curvature.ts` + `.test.ts` — generic finite-difference curvature with per-rep override seam.
- `src/features/paths/curves/curve-conformance.test.ts` — shared fixture run through all four reps.
- `src/features/paths/curves/index.ts` — public exports.
- `demo/demos/CurveLabDemo.tsx` — top-level demo component.
- `demo/demos/curveLab/presets.ts` — five seeded `SharedAnchor[]` configs.
- `demo/demos/curveLab/overlays.ts` — overlay layer factories (anchors+controls, curvature comb, inflections+extrema).
- `demo/demos/curveLab/RepresentationPanel.tsx` — one of four panels.
- `demo/demos/curveLab/ReadoutHud.tsx` — numerical stats panel.
- `tests/e2e/curve-lab.spec.ts` — anchor drag propagates across panels.

**Modified:**

- `src/features/paths/index.ts` — re-export the curves module.
- `src/index.ts` — re-export `SharedAnchor`, `CurveRepresentation`, the four reps, `curvatureAt`.
- `demo/registry.ts` — register `CurveLabDemo`.

---

## Pre-flight

- [ ] **Step 1: Verify we're on the right branch**

```bash
git branch --show-current
git status --short
```

Expected: on `demo-e2e-suite`, clean working tree (or pre-existing dirty files unrelated to this plan).

- [ ] **Step 2: Verify the kit tests are green before starting**

```bash
npx vitest run --project=kit
```

Expected: all green (baseline before any new code).

---

## Task 1: Shared types

The interface every representation implements. Locking this down first means every subsequent task slots into a known shape.

**Files:**

- Create: `src/features/paths/curves/types.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/features/paths/curves/types.ts
import type { PolygonPath } from '../types';

/** A point in the shared anchor set. Every representation reads only the
 *  fields it cares about: cubic Bezier reads inHandle/outHandle; NURBS
 *  reads weight; Spiro reads spiroType. Edits to position propagate to
 *  every representation; edits to per-rep fields only affect that rep. */
export interface SharedAnchor {
  x: number;
  y: number;
  /** Cubic Bezier tangent handles in world coords. Default undefined =
   *  smooth (handles auto-derived from neighbors). */
  inHandle?: { x: number; y: number };
  outHandle?: { x: number; y: number };
  /** NURBS rational weight. Default 1 (non-rational B-spline). Clamped
   *  ≥ 1e-3 by the UI. */
  weight?: number;
  /** Spiro continuity class at this anchor. Default 'g2-smooth'. */
  spiroType?: 'corner' | 'g2-smooth' | 'g4-smooth';
}

export type CurveRepKind = 'bezierCubic' | 'bezierQuadratic' | 'nurbs' | 'spiro';

/** A user-facing control surfaced by a representation. Rendered uniformly
 *  by the demo's panel sidebar. */
export type Discriminator =
  | { kind: 'slider'; label: string; anchorIndex: number; field: string;
      min: number; max: number; step: number; value: number }
  | { kind: 'enum'; label: string; anchorIndex: number; field: string;
      options: readonly string[]; value: string }
  | { kind: 'handle'; anchorIndex: number; which: 'in' | 'out' };

/** A curve representation. Same anchor set rendered four ways. */
export interface CurveRepresentation {
  kind: CurveRepKind;
  label: string;
  /** Evaluate the curve at parameter `t ∈ [0, 1]`. */
  evaluate(anchors: SharedAnchor[], t: number): { x: number; y: number };
  /** Convert anchors to a kit PolygonPath for the renderer. */
  toPath(anchors: SharedAnchor[]): PolygonPath;
  /** Signed local curvature at parameter `t`. Drives the curvature-comb
   *  overlay; positive curls left, negative curls right. */
  curvatureAt(anchors: SharedAnchor[], t: number): number;
  /** Per-rep controls (handle drag enables, weight sliders, type pickers). */
  discriminators(anchors: SharedAnchor[]): Discriminator[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/paths/curves/types.ts
git commit -m "feat(curves): SharedAnchor + CurveRepresentation types"
```

---

## Task 2: Cubic Bezier representation

Wraps the existing kit math. Smallest of the four — proves the interface fits.

**Files:**

- Create: `src/features/paths/curves/bezierCubic.ts`
- Create: `src/features/paths/curves/bezierCubic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/paths/curves/bezierCubic.test.ts
import { describe, it, expect } from 'vitest';
import { bezierCubic } from './bezierCubic';
import type { SharedAnchor } from './types';

describe('bezierCubic', () => {
  it('evaluate at t=0 returns first anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0, inHandle: { x: 70, y: 30 } },
    ];
    const p = bezierCubic.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0, inHandle: { x: 70, y: 30 } },
    ];
    const p = bezierCubic.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('toPath returns a polygon with M then C commands', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: -30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: -30 } },
    ];
    const path = bezierCubic.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.commands[0]).toBe(0); // PATH_M
    expect(path.commands[1]).toBe(2); // PATH_C
  });

  it('curvatureAt returns 0 for collinear anchors with collinear handles', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: 0 } },
      { x: 100, y: 0, inHandle: { x: 70, y: 0 } },
    ];
    const k = bezierCubic.curvatureAt(anchors, 0.5);
    expect(Math.abs(k)).toBeLessThan(1e-6);
  });

  it('discriminators emits one handle pair per relevant anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: 30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: 30 } },
    ];
    const d = bezierCubic.discriminators(anchors);
    const handles = d.filter((x) => x.kind === 'handle');
    expect(handles.length).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/paths/curves/bezierCubic.test.ts`
Expected: FAIL — `bezierCubic` not exported.

- [ ] **Step 3: Implement**

```ts
// src/features/paths/curves/bezierCubic.ts
import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_C, PATH_M, type PolygonPath } from '../types';

/** Default handle distance when an anchor has no explicit in/out handle.
 *  1/3 of the inter-anchor distance is a sensible smooth-curve default. */
const DEFAULT_HANDLE_FRACTION = 1 / 3;

function defaultOutHandle(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  if (a.outHandle) return a.outHandle;
  return {
    x: a.x + (b.x - a.x) * DEFAULT_HANDLE_FRACTION,
    y: a.y + (b.y - a.y) * DEFAULT_HANDLE_FRACTION,
  };
}

function defaultInHandle(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  if (b.inHandle) return b.inHandle;
  return {
    x: b.x - (b.x - a.x) * DEFAULT_HANDLE_FRACTION,
    y: b.y - (b.y - a.y) * DEFAULT_HANDLE_FRACTION,
  };
}

/** Locate the cubic segment containing global parameter `t`. Returns the
 *  segment index and the local parameter within that segment. */
function segmentAt(anchors: SharedAnchor[], t: number): { segIdx: number; localT: number } {
  if (anchors.length < 2) return { segIdx: 0, localT: 0 };
  const segments = anchors.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const segIdx = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - segIdx;
  return { segIdx, localT };
}

function cubicEval(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

/** First derivative of cubic Bezier (a quadratic Bezier). */
function cubicDeriv1(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
    y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y),
  };
}

/** Second derivative of cubic Bezier (a linear Bezier). */
function cubicDeriv2(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 6 * u * (p2.x - 2 * p1.x + p0.x) + 6 * t * (p3.x - 2 * p2.x + p1.x),
    y: 6 * u * (p2.y - 2 * p1.y + p0.y) + 6 * t * (p3.y - 2 * p2.y + p1.y),
  };
}

export const bezierCubic: CurveRepresentation = {
  kind: 'bezierCubic',
  label: 'Cubic Bezier',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    return cubicEval(a, defaultOutHandle(a, b), defaultInHandle(a, b), b, localT);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [anchors[0].x, anchors[0].y];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      const c1 = defaultOutHandle(a, b);
      const c2 = defaultInHandle(a, b);
      cmds.push(PATH_C);
      xs.push(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    }
    return {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(xs),
      fillRule: 'nonzero',
    };
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    const p0 = a;
    const p1 = defaultOutHandle(a, b);
    const p2 = defaultInHandle(a, b);
    const p3 = b;
    const d1 = cubicDeriv1(p0, p1, p2, p3, localT);
    const d2 = cubicDeriv2(p0, p1, p2, p3, localT);
    const num = d1.x * d2.y - d1.y * d2.x;
    const den = Math.pow(d1.x * d1.x + d1.y * d1.y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      const a = anchors[i];
      if (a.outHandle || (i + 1 < anchors.length)) {
        out.push({ kind: 'handle', anchorIndex: i, which: 'out' });
      }
      if (a.inHandle || i > 0) {
        out.push({ kind: 'handle', anchorIndex: i, which: 'in' });
      }
    }
    return out;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/paths/curves/bezierCubic.test.ts`
Expected: PASS, 5/5.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/curves/bezierCubic.ts src/features/paths/curves/bezierCubic.test.ts
git commit -m "feat(curves): cubic Bezier representation"
```

---

## Task 3: Quadratic Bezier representation

Midpoint approximation from the cubic handles. Loses fidelity on sharp curves — that's the teaching point.

**Files:**

- Create: `src/features/paths/curves/bezierQuadratic.ts`
- Create: `src/features/paths/curves/bezierQuadratic.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/paths/curves/bezierQuadratic.test.ts
import { describe, it, expect } from 'vitest';
import { bezierQuadratic } from './bezierQuadratic';
import type { SharedAnchor } from './types';

describe('bezierQuadratic', () => {
  it('evaluate at t=0 returns first anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const p = bezierQuadratic.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    const p = bezierQuadratic.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(0);
  });

  it('toPath returns a polygon with M then Q commands', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: -30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: -30 } },
    ];
    const path = bezierQuadratic.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.commands[0]).toBe(0); // PATH_M
    expect(path.commands[1]).toBe(3); // PATH_Q
  });

  it('midpoint approximation: quadratic control sits between the two cubic controls', () => {
    // Cubic handles at (30, -30) and (70, -30) → midpoint is (50, -30).
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0, outHandle: { x: 30, y: -30 } },
      { x: 100, y: 0, inHandle: { x: 70, y: -30 } },
    ];
    const path = bezierQuadratic.toPath(anchors);
    // Coords: M(0,0) Q(cx, cy, 100, 0). cx/cy at index 2/3.
    expect(path.coords[2]).toBeCloseTo(50);
    expect(path.coords[3]).toBeCloseTo(-30);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/paths/curves/bezierQuadratic.test.ts`
Expected: FAIL — `bezierQuadratic` not exported.

- [ ] **Step 3: Implement**

```ts
// src/features/paths/curves/bezierQuadratic.ts
import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_M, PATH_Q, type PolygonPath } from '../types';

const DEFAULT_HANDLE_FRACTION = 1 / 3;

function defaultOutHandle(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  if (a.outHandle) return a.outHandle;
  return {
    x: a.x + (b.x - a.x) * DEFAULT_HANDLE_FRACTION,
    y: a.y + (b.y - a.y) * DEFAULT_HANDLE_FRACTION,
  };
}

function defaultInHandle(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  if (b.inHandle) return b.inHandle;
  return {
    x: b.x - (b.x - a.x) * DEFAULT_HANDLE_FRACTION,
    y: b.y - (b.y - a.y) * DEFAULT_HANDLE_FRACTION,
  };
}

function quadControl(a: SharedAnchor, b: SharedAnchor): { x: number; y: number } {
  const c1 = defaultOutHandle(a, b);
  const c2 = defaultInHandle(a, b);
  return { x: (c1.x + c2.x) / 2, y: (c1.y + c2.y) / 2 };
}

function segmentAt(anchors: SharedAnchor[], t: number): { segIdx: number; localT: number } {
  if (anchors.length < 2) return { segIdx: 0, localT: 0 };
  const segments = anchors.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const segIdx = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - segIdx;
  return { segIdx, localT };
}

function quadEval(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  };
}

function quadDeriv1(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: 2 * u * (p1.x - p0.x) + 2 * t * (p2.x - p1.x),
    y: 2 * u * (p1.y - p0.y) + 2 * t * (p2.y - p1.y),
  };
}

function quadDeriv2(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
): { x: number; y: number } {
  return {
    x: 2 * (p2.x - 2 * p1.x + p0.x),
    y: 2 * (p2.y - 2 * p1.y + p0.y),
  };
}

export const bezierQuadratic: CurveRepresentation = {
  kind: 'bezierQuadratic',
  label: 'Quadratic Bezier',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    return quadEval(a, quadControl(a, b), b, localT);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [anchors[0].x, anchors[0].y];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const a = anchors[i];
      const b = anchors[i + 1];
      const q = quadControl(a, b);
      cmds.push(PATH_Q);
      xs.push(q.x, q.y, b.x, b.y);
    }
    return {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(xs),
      fillRule: 'nonzero',
    };
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    const p1 = quadControl(a, b);
    const d1 = quadDeriv1(a, p1, b, localT);
    const d2 = quadDeriv2(a, p1, b);
    const num = d1.x * d2.y - d1.y * d2.x;
    const den = Math.pow(d1.x * d1.x + d1.y * d1.y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(_anchors): Discriminator[] {
    // Quadratic has no user-facing controls — each segment's quadratic
    // control is fully determined by the cubic handles via midpoint.
    return [];
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/paths/curves/bezierQuadratic.test.ts`
Expected: PASS, 4/4.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/curves/bezierQuadratic.ts src/features/paths/curves/bezierQuadratic.test.ts
git commit -m "feat(curves): quadratic Bezier representation (midpoint approximation)"
```

---

## Task 4: NURBS representation

Cubic NURBS with uniform open knot vector and per-anchor weights. de Boor evaluation.

**Files:**

- Create: `src/features/paths/curves/nurbs.ts`
- Create: `src/features/paths/curves/nurbs.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/paths/curves/nurbs.test.ts
import { describe, it, expect } from 'vitest';
import { nurbs } from './nurbs';
import type { SharedAnchor } from './types';

describe('nurbs', () => {
  it('evaluate at t=0 returns first anchor (uniform open knot vector)', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 },
    ];
    const p = nurbs.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor (uniform open knot vector)', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 },
    ];
    const p = nurbs.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(150);
    expect(p.y).toBeCloseTo(0);
  });

  it('with all weights = 1, midpoint of a 4-anchor square approximates a flat curve', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 0 },
    ];
    const p = nurbs.evaluate(anchors, 0.5);
    expect(p.y).toBeCloseTo(0);
  });

  it('discriminators emits one weight slider per anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 0 }, { x: 150, y: 50 },
    ];
    const d = nurbs.discriminators(anchors);
    const sliders = d.filter((x) => x.kind === 'slider' && x.field === 'weight');
    expect(sliders.length).toBe(4);
  });

  it('toPath returns a non-empty polygon for valid anchors', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }, { x: 150, y: 100 },
    ];
    const path = nurbs.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.coords.length).toBeGreaterThan(2);
  });

  it('returns empty path for fewer than 2 anchors', () => {
    const path = nurbs.toPath([]);
    expect(path.coords.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/paths/curves/nurbs.test.ts`
Expected: FAIL — `nurbs` not exported.

- [ ] **Step 3: Implement**

```ts
// src/features/paths/curves/nurbs.ts
import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_L, PATH_M, type PolygonPath } from '../types';

const DEGREE = 3;
const WEIGHT_MIN = 1e-3;
const WEIGHT_MAX = 8;
const FLATTEN_SAMPLES = 64;

/** Build a uniform open knot vector. For n control points and degree p,
 *  knot vector length is n + p + 1: the first p+1 knots are 0, the last
 *  p+1 knots are 1, intermediate knots are evenly spaced. This is the
 *  standard "clamped" form so the curve passes through the first and
 *  last control points. */
function openUniformKnots(n: number, p = DEGREE): number[] {
  const m = n + p + 1;
  const knots: number[] = [];
  for (let i = 0; i < m; i++) {
    if (i <= p) knots.push(0);
    else if (i >= n) knots.push(1);
    else knots.push((i - p) / (n - p));
  }
  return knots;
}

/** Find the knot span index for parameter `u`. Returns i such that
 *  knots[i] <= u < knots[i+1] (with end-point handling). */
function findSpan(n: number, p: number, u: number, knots: number[]): number {
  if (u >= knots[n]) return n - 1;
  if (u <= knots[p]) return p;
  let lo = p;
  let hi = n;
  let mid = (lo + hi) >> 1;
  while (u < knots[mid] || u >= knots[mid + 1]) {
    if (u < knots[mid]) hi = mid;
    else lo = mid;
    mid = (lo + hi) >> 1;
  }
  return mid;
}

/** Compute the non-zero B-spline basis functions at parameter u, knot span i. */
function basisFunctions(i: number, u: number, p: number, knots: number[]): number[] {
  const N = new Array<number>(p + 1).fill(0);
  N[0] = 1;
  const left = new Array<number>(p + 1).fill(0);
  const right = new Array<number>(p + 1).fill(0);
  for (let j = 1; j <= p; j++) {
    left[j] = u - knots[i + 1 - j];
    right[j] = knots[i + j] - u;
    let saved = 0;
    for (let r = 0; r < j; r++) {
      const temp = N[r] / (right[r + 1] + left[j - r]);
      N[r] = saved + right[r + 1] * temp;
      saved = left[j - r] * temp;
    }
    N[j] = saved;
  }
  return N;
}

function weightOf(a: SharedAnchor): number {
  const w = a.weight ?? 1;
  return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, w));
}

/** Evaluate a 2D rational B-spline at parameter u ∈ [0, 1]. */
function evalNurbs(anchors: SharedAnchor[], u: number): { x: number; y: number } {
  const n = anchors.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { x: anchors[0].x, y: anchors[0].y };
  const p = Math.min(DEGREE, n - 1);
  const knots = openUniformKnots(n, p);
  const clamped = Math.min(Math.max(u, 0), 1);
  const span = findSpan(n, p, clamped, knots);
  const N = basisFunctions(span, clamped, p, knots);
  let wx = 0;
  let wy = 0;
  let wTotal = 0;
  for (let j = 0; j <= p; j++) {
    const idx = span - p + j;
    const a = anchors[idx];
    const w = weightOf(a);
    wx += N[j] * w * a.x;
    wy += N[j] * w * a.y;
    wTotal += N[j] * w;
  }
  if (wTotal < 1e-12) return { x: anchors[0].x, y: anchors[0].y };
  return { x: wx / wTotal, y: wy / wTotal };
}

export const nurbs: CurveRepresentation = {
  kind: 'nurbs',
  label: 'NURBS',
  evaluate(anchors, t) {
    return evalNurbs(anchors, t);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    // Flatten via uniform sampling — straightforward, accurate enough at
    // 64 samples for visual demo. Production code could use adaptive
    // subdivision; not worth the complexity here.
    const cmds: number[] = [PATH_M];
    const xs: number[] = [];
    for (let s = 0; s <= FLATTEN_SAMPLES; s++) {
      const t = s / FLATTEN_SAMPLES;
      const p = evalNurbs(anchors, t);
      xs.push(p.x, p.y);
      if (s > 0) cmds.push(PATH_L);
    }
    return {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(xs),
      fillRule: 'nonzero',
    };
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    // Finite-difference curvature: central difference at t for first
    // derivative; central difference of first derivatives for second.
    const eps = 1e-3;
    const t0 = Math.max(0, t - eps);
    const t1 = Math.min(1, t + eps);
    const p0 = evalNurbs(anchors, t0);
    const p2 = evalNurbs(anchors, t1);
    const pm = evalNurbs(anchors, t);
    const d1x = (p2.x - p0.x) / (t1 - t0);
    const d1y = (p2.y - p0.y) / (t1 - t0);
    const d2x = (p2.x - 2 * pm.x + p0.x) / (eps * eps);
    const d2y = (p2.y - 2 * pm.y + p0.y) / (eps * eps);
    const num = d1x * d2y - d1y * d2x;
    const den = Math.pow(d1x * d1x + d1y * d1y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      out.push({
        kind: 'slider',
        label: `w${i}`,
        anchorIndex: i,
        field: 'weight',
        min: WEIGHT_MIN,
        max: WEIGHT_MAX,
        step: 0.1,
        value: weightOf(anchors[i]),
      });
    }
    return out;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/paths/curves/nurbs.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/curves/nurbs.ts src/features/paths/curves/nurbs.test.ts
git commit -m "feat(curves): NURBS representation (cubic, uniform open knots, per-anchor weights)"
```

---

## Task 5: Spiro representation

Raph Levien's κ-curve solver, ported. Implementation note: the full Spiro solver is ~500 lines of numerical iteration. To keep this task scoped, this v1 ships **interpolating-spline-by-tangent-fit**, a simpler G²-continuous spline that produces visually-similar output to true Spiro for smooth-only anchor sets and falls back to corner handling for corners. True Levien Spiro is a v1.1 swap-out behind the same interface.

The trade-off documented in the spec's Open Questions #1.

**Files:**

- Create: `src/features/paths/curves/spiro.ts`
- Create: `src/features/paths/curves/spiro.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/paths/curves/spiro.test.ts
import { describe, it, expect } from 'vitest';
import { spiro } from './spiro';
import type { SharedAnchor } from './types';

describe('spiro', () => {
  it('evaluate at t=0 returns first anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const p = spiro.evaluate(anchors, 0);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
  });

  it('evaluate at t=1 returns last anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const p = spiro.evaluate(anchors, 1);
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(100);
  });

  it('toPath returns a polygon with M + C commands per segment', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const path = spiro.toPath(anchors);
    expect(path.kind).toBe('polygon');
    expect(path.commands[0]).toBe(0); // PATH_M
    // Subsequent commands are PATH_C (2) — one per segment.
    expect(path.commands[1]).toBe(2);
  });

  it('discriminators emits one type picker per anchor', () => {
    const anchors: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const d = spiro.discriminators(anchors);
    const enums = d.filter((x) => x.kind === 'enum' && x.field === 'spiroType');
    expect(enums.length).toBe(3);
  });

  it('returns empty path for fewer than 2 anchors', () => {
    const path = spiro.toPath([]);
    expect(path.coords.length).toBe(0);
  });

  it('corner anchors produce sharper segments than smooth anchors', () => {
    // A 90-degree corner. With g2-smooth all-around, the curve through
    // (100, 0) bends gently. With spiroType: 'corner' at index 1, the
    // segments meeting at (100, 0) keep their endpoint tangents along
    // the polyline edges — visibly sharper.
    const smooth: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 },
    ];
    const corner: SharedAnchor[] = [
      { x: 0, y: 0 }, { x: 100, y: 0, spiroType: 'corner' }, { x: 100, y: 100 },
    ];
    // Sample near the corner anchor (t ≈ 0.5).
    const smoothMid = spiro.evaluate(smooth, 0.5);
    const cornerMid = spiro.evaluate(corner, 0.5);
    // Corner version sits closer to (100, 0) than the smoothed version.
    const dSmooth = Math.hypot(smoothMid.x - 100, smoothMid.y - 0);
    const dCorner = Math.hypot(cornerMid.x - 100, cornerMid.y - 0);
    expect(dCorner).toBeLessThan(dSmooth);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/paths/curves/spiro.test.ts`
Expected: FAIL — `spiro` not exported.

- [ ] **Step 3: Implement**

```ts
// src/features/paths/curves/spiro.ts
//
// v1 Spiro: interpolating cubic spline with tangents computed from
// neighbor positions (Catmull-Rom-style for smooth anchors) and pinned
// to incoming/outgoing edges for corner anchors. This is NOT the full
// Raph Levien κ-curve solver — that's a global numerical iteration that
// minimizes curvature variation across the whole curve. What we ship
// here is a tangent-pinned cubic that's visually similar for smooth
// anchor sets and correctly sharp at corners. v1.1 swaps in the real
// Spiro behind the same module surface.
import type { CurveRepresentation, Discriminator, SharedAnchor } from './types';
import { PATH_C, PATH_M, type PolygonPath } from '../types';

const TANGENT_SCALE = 1 / 3;

function isCorner(a: SharedAnchor): boolean {
  return a.spiroType === 'corner';
}

/** Tangent direction at anchor i. Smooth: average of incoming + outgoing
 *  edge directions, weighted by inverse edge length so short edges don't
 *  dominate. Corner: returns null — caller handles the discontinuity by
 *  pinning the segment's outgoing tangent to the outgoing edge and the
 *  incoming tangent of the next segment to its incoming edge. */
function smoothTangent(anchors: SharedAnchor[], i: number): { x: number; y: number } | null {
  if (isCorner(anchors[i])) return null;
  const prev = i > 0 ? anchors[i - 1] : null;
  const next = i + 1 < anchors.length ? anchors[i + 1] : null;
  if (!prev && !next) return null;
  if (!prev) {
    return { x: next!.x - anchors[i].x, y: next!.y - anchors[i].y };
  }
  if (!next) {
    return { x: anchors[i].x - prev.x, y: anchors[i].y - prev.y };
  }
  // Centripetal-style average: weight each edge by 1/length so short
  // edges contribute less. Reduces the "over-curl" at sharp turns.
  const inDX = anchors[i].x - prev.x;
  const inDY = anchors[i].y - prev.y;
  const outDX = next.x - anchors[i].x;
  const outDY = next.y - anchors[i].y;
  const inLen = Math.hypot(inDX, inDY) || 1;
  const outLen = Math.hypot(outDX, outDY) || 1;
  return {
    x: inDX / inLen + outDX / outLen,
    y: inDY / inLen + outDY / outLen,
  };
}

/** Return the two cubic control points for the segment between anchors
 *  i and i+1. Handles corner-anchor cases by pinning the relevant tangent
 *  to the polyline edge. */
function controlsFor(
  anchors: SharedAnchor[],
  i: number,
): { c1: { x: number; y: number }; c2: { x: number; y: number } } {
  const a = anchors[i];
  const b = anchors[i + 1];
  const edge = { x: b.x - a.x, y: b.y - a.y };
  const edgeLen = Math.hypot(edge.x, edge.y) || 1;

  const tA = smoothTangent(anchors, i);
  const tB = smoothTangent(anchors, i + 1);

  // Outgoing tangent at A: smooth tangent if available, else the edge
  // direction (corner anchor).
  const outA = tA ?? edge;
  // Incoming tangent at B: smooth tangent if available, else the edge.
  const outB = tB ?? edge;

  // Normalize and scale to a fraction of the segment length so the
  // handles produce a smooth-looking cubic without overshoot.
  const outALen = Math.hypot(outA.x, outA.y) || 1;
  const outBLen = Math.hypot(outB.x, outB.y) || 1;
  const handleLen = edgeLen * TANGENT_SCALE;
  return {
    c1: {
      x: a.x + (outA.x / outALen) * handleLen,
      y: a.y + (outA.y / outALen) * handleLen,
    },
    c2: {
      x: b.x - (outB.x / outBLen) * handleLen,
      y: b.y - (outB.y / outBLen) * handleLen,
    },
  };
}

function segmentAt(anchors: SharedAnchor[], t: number): { segIdx: number; localT: number } {
  if (anchors.length < 2) return { segIdx: 0, localT: 0 };
  const segments = anchors.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * segments;
  const segIdx = Math.min(Math.floor(scaled), segments - 1);
  const localT = scaled - segIdx;
  return { segIdx, localT };
}

function cubicEval(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  const u = 1 - t;
  const b0 = u * u * u;
  const b1 = 3 * u * u * t;
  const b2 = 3 * u * t * t;
  const b3 = t * t * t;
  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
  };
}

export const spiro: CurveRepresentation = {
  kind: 'spiro',
  label: 'Spiro (κ-curves v1)',
  evaluate(anchors, t) {
    if (anchors.length < 2) return { x: anchors[0]?.x ?? 0, y: anchors[0]?.y ?? 0 };
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    const { c1, c2 } = controlsFor(anchors, segIdx);
    return cubicEval(a, c1, c2, b, localT);
  },
  toPath(anchors) {
    if (anchors.length < 2) {
      return { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' };
    }
    const cmds: number[] = [PATH_M];
    const xs: number[] = [anchors[0].x, anchors[0].y];
    for (let i = 0; i + 1 < anchors.length; i++) {
      const b = anchors[i + 1];
      const { c1, c2 } = controlsFor(anchors, i);
      cmds.push(PATH_C);
      xs.push(c1.x, c1.y, c2.x, c2.y, b.x, b.y);
    }
    return {
      kind: 'polygon',
      commands: new Uint8Array(cmds),
      coords: new Float32Array(xs),
      fillRule: 'nonzero',
    };
  },
  curvatureAt(anchors, t) {
    if (anchors.length < 2) return 0;
    // Use the same approach as the bezier curvature: read the cubic
    // segment we evaluate on and apply the closed-form curvature.
    const { segIdx, localT } = segmentAt(anchors, t);
    const a = anchors[segIdx];
    const b = anchors[segIdx + 1];
    const { c1, c2 } = controlsFor(anchors, segIdx);
    const u = 1 - localT;
    const d1x = 3 * u * u * (c1.x - a.x) + 6 * u * localT * (c2.x - c1.x) + 3 * localT * localT * (b.x - c2.x);
    const d1y = 3 * u * u * (c1.y - a.y) + 6 * u * localT * (c2.y - c1.y) + 3 * localT * localT * (b.y - c2.y);
    const d2x = 6 * u * (c2.x - 2 * c1.x + a.x) + 6 * localT * (b.x - 2 * c2.x + c1.x);
    const d2y = 6 * u * (c2.y - 2 * c1.y + a.y) + 6 * localT * (b.y - 2 * c2.y + c1.y);
    const num = d1x * d2y - d1y * d2x;
    const den = Math.pow(d1x * d1x + d1y * d1y, 1.5);
    if (den < 1e-12) return 0;
    return num / den;
  },
  discriminators(anchors) {
    const out: Discriminator[] = [];
    for (let i = 0; i < anchors.length; i++) {
      out.push({
        kind: 'enum',
        label: `t${i}`,
        anchorIndex: i,
        field: 'spiroType',
        options: ['g2-smooth', 'g4-smooth', 'corner'] as const,
        value: anchors[i].spiroType ?? 'g2-smooth',
      });
    }
    return out;
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/paths/curves/spiro.test.ts`
Expected: PASS, 6/6.

- [ ] **Step 5: Commit**

```bash
git add src/features/paths/curves/spiro.ts src/features/paths/curves/spiro.test.ts
git commit -m "feat(curves): Spiro v1 (tangent-pinned cubic; G2 / corner aware)"
```

---

## Task 6: Conformance test + library entrypoint

A shared fixture run through all four reps catches interface drift; the index module is the public face.

**Files:**

- Create: `src/features/paths/curves/curve-conformance.test.ts`
- Create: `src/features/paths/curves/index.ts`

- [ ] **Step 1: Write the conformance test**

```ts
// src/features/paths/curves/curve-conformance.test.ts
import { describe, it, expect } from 'vitest';
import { bezierCubic } from './bezierCubic';
import { bezierQuadratic } from './bezierQuadratic';
import { nurbs } from './nurbs';
import { spiro } from './spiro';
import type { CurveRepresentation, SharedAnchor } from './types';

// S-curve fixture: three anchors, all smooth defaults.
const sCurve: SharedAnchor[] = [
  { x: 0, y: 50 },
  { x: 50, y: -50 },
  { x: 100, y: 50 },
];

const reps: CurveRepresentation[] = [bezierCubic, bezierQuadratic, nurbs, spiro];

describe.each(reps)('CurveRepresentation contract: $kind', (rep) => {
  it('evaluate(t=0) returns the first anchor (within 1px)', () => {
    const p = rep.evaluate(sCurve, 0);
    expect(p.x).toBeCloseTo(sCurve[0].x, 0);
    expect(p.y).toBeCloseTo(sCurve[0].y, 0);
  });

  it('evaluate(t=1) returns the last anchor (within 1px)', () => {
    const p = rep.evaluate(sCurve, 1);
    expect(p.x).toBeCloseTo(sCurve[sCurve.length - 1].x, 0);
    expect(p.y).toBeCloseTo(sCurve[sCurve.length - 1].y, 0);
  });

  it('toPath returns a non-empty PolygonPath', () => {
    const path = rep.toPath(sCurve);
    expect(path.kind).toBe('polygon');
    expect(path.coords.length).toBeGreaterThan(2);
  });

  it('curvatureAt returns finite values across [0, 1]', () => {
    for (let i = 0; i <= 10; i++) {
      const k = rep.curvatureAt(sCurve, i / 10);
      expect(Number.isFinite(k)).toBe(true);
    }
  });

  it('toPath returns an empty polygon for empty anchor list', () => {
    const path = rep.toPath([]);
    expect(path.coords.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run conformance to verify it passes**

Run: `npx vitest run src/features/paths/curves/curve-conformance.test.ts`
Expected: PASS, 5 tests × 4 reps = 20.

- [ ] **Step 3: Write the index module**

```ts
// src/features/paths/curves/index.ts
export type { SharedAnchor, CurveRepKind, CurveRepresentation, Discriminator } from './types';
export { bezierCubic } from './bezierCubic';
export { bezierQuadratic } from './bezierQuadratic';
export { nurbs } from './nurbs';
export { spiro } from './spiro';

import { bezierCubic } from './bezierCubic';
import { bezierQuadratic } from './bezierQuadratic';
import { nurbs } from './nurbs';
import { spiro } from './spiro';
import type { CurveRepresentation, CurveRepKind } from './types';

/** All four kit representations, keyed by `CurveRepKind`. */
export const CURVE_REPS: Readonly<Record<CurveRepKind, CurveRepresentation>> = {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
};
```

- [ ] **Step 4: Re-export from `features/paths`**

Edit `src/features/paths/index.ts` — add at the end (after the existing `export {} from './booleans'` line):

```ts
export * from './curves';
```

- [ ] **Step 5: Run typecheck + vitest**

```bash
npx tsc --noEmit
npx vitest run src/features/paths/curves
```

Expected: typecheck clean (ignore the pre-existing `Badge.stories.tsx` error); 20+ tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/paths/curves/curve-conformance.test.ts src/features/paths/curves/index.ts src/features/paths/index.ts
git commit -m "feat(curves): conformance test + library entrypoint"
```

---

## Task 7: Demo presets

Five seeded fixtures that exercise each representation's strengths.

**Files:**

- Create: `demo/demos/curveLab/presets.ts`

- [ ] **Step 1: Write the presets module**

```ts
// demo/demos/curveLab/presets.ts
import type { SharedAnchor } from '../../../src/features/paths/curves';

export interface CurvePreset {
  id: string;
  label: string;
  description: string;
  anchors: SharedAnchor[];
}

export const CURVE_PRESETS: readonly CurvePreset[] = [
  {
    id: 'smooth-s',
    label: 'Smooth S-curve',
    description: '3 anchors, all smooth — baseline; all four representations look similar here.',
    anchors: [
      { x: 60, y: 220 },
      { x: 200, y: 80 },
      { x: 340, y: 220 },
    ],
  },
  {
    id: 'sharp-corner',
    label: 'Sharp corner',
    description: 'Five anchors, one tagged corner. Spiro pins the corner; Bezier smooths through it.',
    anchors: [
      { x: 40, y: 200 },
      { x: 120, y: 200 },
      { x: 200, y: 60, spiroType: 'corner' },
      { x: 280, y: 200 },
      { x: 360, y: 200 },
    ],
  },
  {
    id: 'near-circle',
    label: 'Near-circle (4 anchors at cardinals)',
    description: 'NURBS with weights ≈ 0.707 hits an exact circle. Bezier and Spiro approximate.',
    anchors: [
      { x: 200, y: 60 },
      { x: 340, y: 200 },
      { x: 200, y: 340 },
      { x: 60, y: 200 },
    ],
  },
  {
    id: 'closed-loop',
    label: 'Closed loop (heart-ish)',
    description: 'Open-curve representations close via a straight return; Spiro v1 doesn\'t support true closed.',
    anchors: [
      { x: 200, y: 80 },
      { x: 340, y: 160 },
      { x: 280, y: 300 },
      { x: 200, y: 360 },
      { x: 120, y: 300 },
      { x: 60, y: 160 },
      { x: 200, y: 80 },
    ],
  },
  {
    id: 'mixed',
    label: 'Mixed: corner + smooth + weighted',
    description: 'Sampler — every rep\'s discriminators do something visible.',
    anchors: [
      { x: 60, y: 200, spiroType: 'corner' },
      { x: 180, y: 80, weight: 2 },
      { x: 300, y: 200, spiroType: 'g4-smooth' },
      { x: 380, y: 320, weight: 0.5 },
    ],
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add demo/demos/curveLab/presets.ts
git commit -m "feat(curveLab): five seeded presets"
```

---

## Task 8: Overlay layer factories

Anchors+controls, curvature comb, inflections+extrema. Each takes the rep + anchors and returns a `RenderLayer`.

**Files:**

- Create: `demo/demos/curveLab/overlays.ts`

- [ ] **Step 1: Write the overlays module**

```ts
// demo/demos/curveLab/overlays.ts
import type { DrawCommand, RenderLayer } from '@orochi235/weasel';
import type { CurveRepresentation, SharedAnchor } from '../../../src/features/paths/curves';

interface View { x: number; y: number; scale: { x: number; y: number } }

function w2s(wx: number, wy: number, view: View): [number, number] {
  return [(wx - view.x) * view.scale.x, (wy - view.y) * view.scale.y];
}

function circle(cx: number, cy: number, r: number): { kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: 'nonzero' } {
  // Quartet of cubic Bezier arcs approximating a circle.
  const k = 0.5522847498;
  return {
    kind: 'polygon',
    commands: new Uint8Array([0, 2, 2, 2, 2]), // M, C, C, C, C
    coords: new Float32Array([
      cx + r, cy,
      cx + r, cy + k * r,  cx + k * r, cy + r,  cx, cy + r,
      cx - k * r, cy + r,  cx - r, cy + k * r,  cx - r, cy,
      cx - r, cy - k * r,  cx - k * r, cy - r,  cx, cy - r,
      cx + k * r, cy - r,  cx + r, cy - k * r,  cx + r, cy,
    ]),
    fillRule: 'nonzero',
  };
}

function squarePath(cx: number, cy: number, size: number): { kind: 'rect'; x: number; y: number; width: number; height: number } {
  const half = size / 2;
  return { kind: 'rect', x: cx - half, y: cy - half, width: size, height: size };
}

function line(ax: number, ay: number, bx: number, by: number): { kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: 'nonzero' } {
  return {
    kind: 'polygon',
    commands: new Uint8Array([0, 1]), // M, L
    coords: new Float32Array([ax, ay, bx, by]),
    fillRule: 'nonzero',
  };
}

/** Layer that draws anchor markers + (for Bezier reps) tangent handles. */
export function createAnchorsLayer(
  rep: CurveRepresentation,
  getAnchors: () => SharedAnchor[],
): RenderLayer<unknown> {
  return {
    id: `curve-lab-anchors-${rep.kind}`,
    label: 'Anchors',
    space: 'screen',
    draw: (_data, view) => {
      const anchors = getAnchors();
      const out: DrawCommand[] = [];
      for (let i = 0; i < anchors.length; i++) {
        const a = anchors[i];
        const [sx, sy] = w2s(a.x, a.y, view);
        out.push({
          kind: 'path',
          path: squarePath(sx, sy, 8),
          fill: { fill: 'solid', color: '#ffffff' },
          stroke: { paint: { fill: 'solid', color: '#3478f6' }, width: 1 },
        });
        // Bezier handles: only the cubic rep exposes them.
        if (rep.kind === 'bezierCubic') {
          if (a.outHandle) {
            const [hx, hy] = w2s(a.outHandle.x, a.outHandle.y, view);
            out.push({
              kind: 'path',
              path: line(sx, sy, hx, hy),
              stroke: { paint: { fill: 'solid', color: '#7da7e8' }, width: 1 },
            });
            out.push({
              kind: 'path',
              path: circle(hx, hy, 4),
              fill: { fill: 'solid', color: 'rgba(125, 167, 232, 0.5)' },
            });
          }
          if (a.inHandle) {
            const [hx, hy] = w2s(a.inHandle.x, a.inHandle.y, view);
            out.push({
              kind: 'path',
              path: line(sx, sy, hx, hy),
              stroke: { paint: { fill: 'solid', color: '#7da7e8' }, width: 1 },
            });
            out.push({
              kind: 'path',
              path: circle(hx, hy, 4),
              fill: { fill: 'solid', color: 'rgba(125, 167, 232, 0.5)' },
            });
          }
        }
      }
      return out;
    },
  };
}

/** Curvature-comb overlay. Samples κ at evenly-spaced t and draws hairs
 *  perpendicular to the curve at each, length = κ × scale. */
export function createCurvatureCombLayer(
  rep: CurveRepresentation,
  getAnchors: () => SharedAnchor[],
  scale = 600,
): RenderLayer<unknown> {
  const SAMPLES = 64;
  return {
    id: `curve-lab-comb-${rep.kind}`,
    label: 'Curvature comb',
    space: 'screen',
    draw: (_data, view) => {
      const anchors = getAnchors();
      if (anchors.length < 2) return [];
      const out: DrawCommand[] = [];
      const eps = 1 / SAMPLES;
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        const p = rep.evaluate(anchors, t);
        // Tangent via finite difference.
        const t0 = Math.max(0, t - eps);
        const t1 = Math.min(1, t + eps);
        const p0 = rep.evaluate(anchors, t0);
        const p1 = rep.evaluate(anchors, t1);
        const tx = p1.x - p0.x;
        const ty = p1.y - p0.y;
        const tLen = Math.hypot(tx, ty) || 1;
        // Normal perpendicular to tangent (rotate 90°).
        const nx = -ty / tLen;
        const ny = tx / tLen;
        const k = rep.curvatureAt(anchors, t);
        const len = k * scale;
        const [sx, sy] = w2s(p.x, p.y, view);
        const [ex, ey] = w2s(p.x + nx * len, p.y + ny * len, view);
        out.push({
          kind: 'path',
          path: line(sx, sy, ex, ey),
          stroke: { paint: { fill: 'solid', color: 'rgba(255, 120, 80, 0.6)' }, width: 1 },
        });
      }
      return out;
    },
  };
}

/** Inflections + extrema overlay. Sample κ densely; mark sign-changes
 *  (inflection) with hollow rings, local extrema with filled diamonds. */
export function createInflectionsLayer(
  rep: CurveRepresentation,
  getAnchors: () => SharedAnchor[],
): RenderLayer<unknown> {
  const SAMPLES = 128;
  return {
    id: `curve-lab-inflections-${rep.kind}`,
    label: 'Inflections + extrema',
    space: 'screen',
    draw: (_data, view) => {
      const anchors = getAnchors();
      if (anchors.length < 2) return [];
      const ks: number[] = [];
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= SAMPLES; i++) {
        const t = i / SAMPLES;
        ks.push(rep.curvatureAt(anchors, t));
        pts.push(rep.evaluate(anchors, t));
      }
      const out: DrawCommand[] = [];
      for (let i = 1; i < ks.length; i++) {
        // Inflection: sign change between i-1 and i.
        if (ks[i - 1] === 0) continue;
        if (Math.sign(ks[i]) !== Math.sign(ks[i - 1]) && ks[i] !== 0) {
          const p = pts[i];
          const [sx, sy] = w2s(p.x, p.y, view);
          out.push({
            kind: 'path',
            path: circle(sx, sy, 5),
            stroke: { paint: { fill: 'solid', color: '#ffaa00' }, width: 1.5 },
          });
        }
        // Extremum: local max of |κ|.
        if (i > 1 && Math.abs(ks[i - 1]) > Math.abs(ks[i]) && Math.abs(ks[i - 1]) > Math.abs(ks[i - 2])) {
          const p = pts[i - 1];
          const [sx, sy] = w2s(p.x, p.y, view);
          out.push({
            kind: 'path',
            path: squarePath(sx, sy, 6),
            fill: { fill: 'solid', color: '#ffaa00' },
          });
        }
      }
      return out;
    },
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/demos/curveLab/overlays.ts
git commit -m "feat(curveLab): overlay layer factories (anchors, comb, inflections)"
```

---

## Task 9: Numerical readout HUD

A small per-panel info widget showing computed stats.

**Files:**

- Create: `demo/demos/curveLab/ReadoutHud.tsx`

- [ ] **Step 1: Write the readout component**

```tsx
// demo/demos/curveLab/ReadoutHud.tsx
import { useMemo } from 'react';
import type { CurveRepresentation, SharedAnchor } from '../../../src/features/paths/curves';

interface ReadoutHudProps {
  rep: CurveRepresentation;
  anchors: SharedAnchor[];
}

interface CurveStats {
  anchorCount: number;
  segmentCount: number;
  maxAbsCurvature: number;
  rmsCurvature: number;
  arcLength: number;
}

function computeStats(rep: CurveRepresentation, anchors: SharedAnchor[]): CurveStats {
  const SAMPLES = 128;
  if (anchors.length < 2) {
    return { anchorCount: anchors.length, segmentCount: 0, maxAbsCurvature: 0, rmsCurvature: 0, arcLength: 0 };
  }
  let maxAbs = 0;
  let sumSq = 0;
  let arc = 0;
  let prev = rep.evaluate(anchors, 0);
  for (let i = 1; i <= SAMPLES; i++) {
    const t = i / SAMPLES;
    const p = rep.evaluate(anchors, t);
    arc += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
    const k = Math.abs(rep.curvatureAt(anchors, t));
    if (k > maxAbs) maxAbs = k;
    sumSq += k * k;
  }
  const rms = Math.sqrt(sumSq / SAMPLES);
  const path = rep.toPath(anchors);
  // Count drawing commands that aren't M or Z as segments.
  let segs = 0;
  for (let i = 0; i < path.commands.length; i++) {
    const c = path.commands[i];
    if (c !== 0 && c !== 4) segs++;
  }
  return {
    anchorCount: anchors.length,
    segmentCount: segs,
    maxAbsCurvature: maxAbs,
    rmsCurvature: rms,
    arcLength: arc,
  };
}

export function ReadoutHud({ rep, anchors }: ReadoutHudProps) {
  const stats = useMemo(() => computeStats(rep, anchors), [rep, anchors]);
  return (
    <div style={{
      fontSize: 11,
      fontFamily: 'ui-monospace, monospace',
      color: '#d4c4a8',
      padding: '4px 8px',
      borderTop: '1px solid #4a3c2e',
      background: 'rgba(0,0,0,0.2)',
      display: 'grid',
      gridTemplateColumns: 'auto auto',
      columnGap: 8,
      rowGap: 2,
    }}>
      <span>anchors</span><span>{stats.anchorCount}</span>
      <span>segments</span><span>{stats.segmentCount}</span>
      <span>max |κ|</span><span>{stats.maxAbsCurvature.toFixed(4)}</span>
      <span>rms κ</span><span>{stats.rmsCurvature.toFixed(4)}</span>
      <span>length</span><span>{stats.arcLength.toFixed(1)}</span>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add demo/demos/curveLab/ReadoutHud.tsx
git commit -m "feat(curveLab): per-panel numerical readout HUD"
```

---

## Task 10: Representation panel

Wraps a `<SceneCanvas>` for one representation. Reads shared anchors, builds the rep's path, mounts the overlay layers.

**Files:**

- Create: `demo/demos/curveLab/RepresentationPanel.tsx`

- [ ] **Step 1: Write the panel component**

```tsx
// demo/demos/curveLab/RepresentationPanel.tsx
import { useCallback, useMemo, useState } from 'react';
import { SceneCanvas, useScene, useSelection, asNodeId } from '@orochi235/weasel';
import type { DrawCommand, View } from '@orochi235/weasel';
import type { CurveRepresentation, SharedAnchor } from '../../../src/features/paths/curves';
import {
  createAnchorsLayer,
  createCurvatureCombLayer,
  createInflectionsLayer,
} from './overlays';
import { ReadoutHud } from './ReadoutHud';

export interface OverlayFlags {
  anchors: boolean;
  comb: boolean;
  inflections: boolean;
}

export interface RepresentationPanelProps {
  rep: CurveRepresentation;
  anchors: SharedAnchor[];
  overlays: OverlayFlags;
  width: number;
  height: number;
}

const ID = 'curve';

interface PathPose {
  kind: 'polygon';
  commands: Uint8Array;
  coords: Float32Array;
  fillRule: 'nonzero';
}

export function RepresentationPanel({ rep, anchors, overlays, width, height }: RepresentationPanelProps) {
  const path = useMemo(() => rep.toPath(anchors), [rep, anchors]);
  // Stable scene with one node whose pose IS the polygon. We re-key
  // the SceneCanvas on rep changes so it picks up the new initial pose
  // cleanly without manual setPose plumbing for v1.
  const scene = useScene<{ kind: 'curve' }, 'default', PathPose>({
    systemLayers: [{ id: 'default' }],
    initial: [{
      id: asNodeId(ID),
      kind: 'leaf',
      layer: 'default',
      pose: path as PathPose,
      data: { kind: 'curve' },
    }],
  });
  // Sync the scene's pose to the current path on every render — cheap
  // (Float32Array allocation already paid in toPath); SceneCanvas
  // handles the redraw signal.
  useMemo(() => {
    scene.setPose(asNodeId(ID), path as PathPose);
  }, [scene, path]);

  const selection = useSelection({ initial: [asNodeId(ID)], lock: true });
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  const getAnchors = useCallback(() => anchors, [anchors]);

  const anchorsLayer = useMemo(() => createAnchorsLayer(rep, getAnchors), [rep, getAnchors]);
  const combLayer = useMemo(() => createCurvatureCombLayer(rep, getAnchors), [rep, getAnchors]);
  const inflectionsLayer = useMemo(() => createInflectionsLayer(rep, getAnchors), [rep, getAnchors]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', border: '1px solid #4a3c2e' }}>
      <div style={{
        fontSize: 12,
        fontFamily: 'ui-monospace, monospace',
        color: '#d4c4a8',
        padding: '4px 8px',
        background: 'rgba(0,0,0,0.25)',
      }}>
        {rep.label}
      </div>
      <SceneCanvas
        width={width}
        height={height}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        view={view}
        onViewChange={setView}
        layers={{
          scene: {
            drawOne: (_n, p): DrawCommand[] => [{
              kind: 'path',
              path: p as PathPose,
              stroke: { paint: { fill: 'solid', color: '#7fb069' }, width: 2 },
            }],
          },
          selectionOverlay: null,
          ...(overlays.anchors ? { anchors: { layer: anchorsLayer, after: 'scene' } } : {}),
          ...(overlays.comb ? { comb: { layer: combLayer, after: 'scene' } } : {}),
          ...(overlays.inflections ? { inflections: { layer: inflectionsLayer, after: 'scene' } } : {}),
        }}
      />
      <ReadoutHud rep={rep} anchors={anchors} />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "Badge.stories" | head
```

Expected: clean. If "View" isn't exported from `@orochi235/weasel`, change the import to `import type { View } from '../../../src/core/viewport/view';`.

- [ ] **Step 3: Commit**

```bash
git add demo/demos/curveLab/RepresentationPanel.tsx
git commit -m "feat(curveLab): RepresentationPanel — one SceneCanvas per rep"
```

---

## Task 11: Top-level demo + registration

The CurveLabDemo component owns the shared anchor state, preset selector, overlay toggles, and the 2×2 panel grid. Then register it in the demo registry.

**Files:**

- Create: `demo/demos/CurveLabDemo.tsx`
- Modify: `demo/registry.ts`

- [ ] **Step 1: Write the top-level demo**

```tsx
// demo/demos/CurveLabDemo.tsx
import { useMemo, useState } from 'react';
import {
  bezierCubic,
  bezierQuadratic,
  nurbs,
  spiro,
  type SharedAnchor,
} from '../../src/features/paths/curves';
import { CURVE_PRESETS } from './curveLab/presets';
import { RepresentationPanel, type OverlayFlags } from './curveLab/RepresentationPanel';

const PANEL_W = 360;
const PANEL_H = 360;

const REPS = [bezierCubic, bezierQuadratic, nurbs, spiro] as const;

export function CurveLabDemo() {
  const [presetId, setPresetId] = useState(CURVE_PRESETS[0].id);
  const [anchors, setAnchors] = useState<SharedAnchor[]>(() => CURVE_PRESETS[0].anchors);
  const [overlays, setOverlays] = useState<OverlayFlags>({
    anchors: true,
    comb: false,
    inflections: false,
  });

  const preset = useMemo(
    () => CURVE_PRESETS.find((p) => p.id === presetId) ?? CURVE_PRESETS[0],
    [presetId],
  );

  const onPresetChange = (id: string) => {
    setPresetId(id);
    const next = CURVE_PRESETS.find((p) => p.id === id);
    if (next) setAnchors(next.anchors.map((a) => ({ ...a })));
  };

  // E2e probe: expose the live anchor state on the test hook.
  if (typeof window !== 'undefined') {
    const hook = (window as unknown as { __weaselTest?: { registerProbe?: (name: string, fn: () => unknown) => () => void } }).__weaselTest;
    if (hook?.registerProbe) {
      // Register once per render is harmless: registerProbe replaces by name.
      // The kit's probe shape returns whatever the fn returns at probe-time.
      hook.registerProbe('curveLab', () => ({ anchors, presetId }));
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{
        display: 'flex',
        gap: 12,
        padding: 6,
        background: 'rgba(0,0,0,0.2)',
        color: '#d4c4a8',
        fontSize: 12,
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        <label>
          Preset:{' '}
          <select value={presetId} onChange={(e) => onPresetChange(e.currentTarget.value)}>
            {CURVE_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={overlays.anchors}
            onChange={(e) => setOverlays((o) => ({ ...o, anchors: e.currentTarget.checked }))}
          />
          {' '}anchors
        </label>
        <label>
          <input
            type="checkbox"
            checked={overlays.comb}
            onChange={(e) => setOverlays((o) => ({ ...o, comb: e.currentTarget.checked }))}
          />
          {' '}curvature comb
        </label>
        <label>
          <input
            type="checkbox"
            checked={overlays.inflections}
            onChange={(e) => setOverlays((o) => ({ ...o, inflections: e.currentTarget.checked }))}
          />
          {' '}inflections + extrema
        </label>
        <span style={{ marginLeft: 'auto', opacity: 0.6 }}>{preset.description}</span>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${PANEL_W}px ${PANEL_W}px`,
        gridAutoRows: 'min-content',
        gap: 8,
      }}>
        {REPS.map((rep) => (
          <RepresentationPanel
            key={rep.kind}
            rep={rep}
            anchors={anchors}
            overlays={overlays}
            width={PANEL_W}
            height={PANEL_H}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register in `demo/registry.ts`**

Find the entry for `bezier-edit` (around line 260). Add a new entry directly after it, before the closing `]`:

```ts
  {
    id: 'curve-lab',
    title: 'Curve representations lab',
    category: 'Geometry',
    description: 'The same anchor set rendered as cubic Bezier, quadratic Bezier, NURBS, and Spiro (κ-curves) side by side. Toggle the curvature comb, inflection marks, and anchor / control chrome to see where the representations diverge. Five seeded presets; v1 supports anchor editing through the preset; pen-tool authoring is v1.1.',
    hint: 'Switch presets to see the differences; toggle overlays for analysis.',
    Component: CurveLabDemo,
    full: CurveLabDemoFull,
    path: 'demo/demos/CurveLabDemo.tsx',
  },
```

Add the corresponding imports at the top of `registry.ts`:

```ts
import { CurveLabDemo } from './demos/CurveLabDemo';
// If your codebase pattern is to also have a "full" variant per demo, add
// `CurveLabDemoFull` as `CurveLabDemo`. The registry tolerates a single
// Component for both slots.
```

If the registry pattern requires a distinct `Full` variant: change the `full:` line to `full: CurveLabDemo` (reuse). Other demos in this registry show both patterns.

- [ ] **Step 3: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "Badge.stories" | head
```

Expected: clean.

- [ ] **Step 4: Run the kit suite as a smoke check**

```bash
npx vitest run --project=kit
```

Expected: green (no demo files in vitest's kit project — this verifies nothing in the kit broke).

- [ ] **Step 5: Commit**

```bash
git add demo/demos/CurveLabDemo.tsx demo/registry.ts
git commit -m "feat(curveLab): top-level demo + registry entry"
```

---

## Task 12: E2E spec — preset switch propagates across panels

Verifies the four panels stay in sync.

**Files:**

- Create: `tests/e2e/curve-lab.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/curve-lab.spec.ts
import { test, expect } from './fixtures';

interface SharedAnchorEcho { x: number; y: number; weight?: number; spiroType?: string }
interface LabProbe { anchors: SharedAnchorEcho[]; presetId: string }

test('curve lab — preset switch updates the shared anchor state', async ({ demo }) => {
  await demo.goto('curve-lab');
  const initial = (await demo.probe<LabProbe>('curveLab'))!;
  expect(initial).toBeTruthy();
  expect(initial.presetId).toBe('smooth-s');
  const initialCount = initial.anchors.length;

  // Switch to 'sharp-corner' (5 anchors) via the DOM select.
  await demo.page.selectOption('select', 'sharp-corner');

  const after = (await demo.probe<LabProbe>('curveLab'))!;
  expect(after.presetId).toBe('sharp-corner');
  expect(after.anchors.length).toBe(5);
  expect(after.anchors.length).not.toBe(initialCount);

  // The preset includes a corner-tagged anchor.
  expect(after.anchors.some((a) => a.spiroType === 'corner')).toBe(true);
});

test('curve lab — all four panels render their representation labels', async ({ demo }) => {
  await demo.goto('curve-lab');
  const labels = await demo.page.evaluate(() => {
    return Array.from(document.querySelectorAll('div'))
      .map((el) => (el.textContent ?? '').trim())
      .filter((t) => /^(Cubic Bezier|Quadratic Bezier|NURBS|Spiro)/.test(t));
  });
  expect(labels.some((l) => l.startsWith('Cubic Bezier'))).toBe(true);
  expect(labels.some((l) => l.startsWith('Quadratic Bezier'))).toBe(true);
  expect(labels.some((l) => l.startsWith('NURBS'))).toBe(true);
  expect(labels.some((l) => l.startsWith('Spiro'))).toBe(true);
});
```

- [ ] **Step 2: Run the e2e spec**

```bash
npm run test:e2e:demos -- curve-lab.spec.ts
```

Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/curve-lab.spec.ts
git commit -m "test(e2e): curve lab — preset switching + panel labels"
```

---

## Task 13: Re-export from root + full gate

Make the curves module publicly available, then run the full validation gate.

**Files:**

- Modify: `src/index.ts`

- [ ] **Step 1: Find the existing paths re-export block**

```bash
grep -n "from './features/paths'" src/index.ts | head -3
```

The kit re-exports from `./features/paths` already (line ~412 area). The new `* from './curves'` re-export at the end of `src/features/paths/index.ts` from Task 6 means `SharedAnchor`, `CurveRepresentation`, the four reps, and `CURVE_REPS` are reachable through the existing `from './features/paths'` chain. No changes to `src/index.ts` needed if the chain re-export already uses `export *`.

Verify:

```bash
grep -E "export \* from './features/paths'|export \{ [^}]+ \} from './features/paths'" src/index.ts | head
```

If the chain uses named re-exports (e.g., `export { pathToAnchors, ... } from './features/paths'`), add an explicit re-export of the curves symbols. Otherwise the wildcard handles it.

- [ ] **Step 2: Run typecheck**

```bash
npx tsc --noEmit 2>&1 | grep -v "Badge.stories" | head
```

Expected: clean.

- [ ] **Step 3: Run the full kit test suite**

```bash
npx vitest run --project=kit
```

Expected: all green, new curves tests included.

- [ ] **Step 4: Run the full e2e suite**

```bash
npm run test:e2e:demos
```

Expected: all green, including the new curve-lab specs.

- [ ] **Step 5: Manual smoke check**

Verify in browser at `http://localhost:5173/weasel/#curve-lab` that:

1. Four panels render, each labeled with its representation.
2. Preset dropdown lists 5 entries; switching updates all four panels.
3. Anchor checkbox shows white squares at each anchor; cubic Bezier panel additionally shows tangent handles.
4. Curvature comb toggle shows orange hairs perpendicular to each curve.
5. Inflections + extrema toggle marks visible inflection points.

If any of these fail, the underlying bug is most likely in the relevant overlay factory or the panel's layer wiring — fix and amend the corresponding task's commit.

- [ ] **Step 6: Commit any needed adjustments (or skip if no changes)**

If src/index.ts needed an explicit re-export:

```bash
git add src/index.ts
git commit -m "feat(curves): re-export from root index"
```

Otherwise, no commit needed.

---

## Done check

- [ ] All four representations have their own file + unit tests, all green.
- [ ] Conformance test runs all five contract assertions × 4 reps = 20 cases, green.
- [ ] `demo/demos/CurveLabDemo.tsx` registered in `demo/registry.ts` under Geometry.
- [ ] Five presets accessible via dropdown; switching updates the shared anchor state, which propagates to all four panels.
- [ ] Three overlays (anchors, comb, inflections) toggle independently.
- [ ] Per-panel `ReadoutHud` shows anchor count, segment count, max |κ|, RMS κ, length.
- [ ] E2e spec verifies preset switching + panel labels.
- [ ] No console errors in dev or production builds.

Do NOT push without explicit user confirmation.
