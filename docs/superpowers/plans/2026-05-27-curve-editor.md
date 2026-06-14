# CurveEditor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `CurveEditor` React component in `weasel-ui` — a 2D plot for editing functions and parametric paths via centripetal Catmull-Rom control points, with optional weasel-history integration.

**Architecture:** Pure controlled component (`value` + `onChange` + `onChangeCommit`). SVG rendering in three layers (grid/axes, curve path, anchor markers). Centripetal Catmull-Rom for curve math — passes exactly through every anchor, avoids 2D cusps. Mode prop (`'1d' | '2d'`) gates drag-time x-clamping. Optional Op factory (`createSetCurveOp`) for cheap weasel-history wiring at the caller.

**Tech Stack:** TypeScript, React 18, SVG, Vitest, React Testing Library, Storybook 8. Lives in `packages/ui/`.

**Spec:** `docs/superpowers/specs/2026-05-27-curve-editor-design.md`

---

## File Map

All paths relative to worktree root `/Users/mike/src/weasel/.claude/worktrees/curve-editor/`.

```
packages/ui/src/components/CurveEditor/
├── index.ts                  # public exports (CurveEditor, ControlPoint, createSetCurveOp)
├── CurveEditor.tsx           # the React component (~180 lines target)
├── CurveEditor.module.css    # styling, CSS-var tokens
├── catmullRom.ts             # pure math: centripetal sampling, phantom-endpoint reflection
├── catmullRom.test.ts        # unit tests
├── geometry.ts               # model↔plot transforms, hit testing
├── geometry.test.ts          # unit tests
├── setCurveOp.ts             # weasel-history Op factory
├── setCurveOp.test.ts        # unit tests
├── CurveEditor.test.tsx      # integration: drag, add, delete, endpoints, domain
└── CurveEditor.stories.tsx   # Storybook coverage
```

Plus one modification:
- `packages/ui/src/index.ts` — add `export * from './components/CurveEditor';`

---

## Task 1: Pure math — centripetal Catmull-Rom sampling

**Files:**
- Create: `packages/ui/src/components/CurveEditor/catmullRom.ts`
- Create: `packages/ui/src/components/CurveEditor/catmullRom.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/ui/src/components/CurveEditor/catmullRom.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { sampleCurve, segmentSampleAt, type Point } from './catmullRom';

describe('segmentSampleAt', () => {
  it('returns p1 at t=0', () => {
    const p0: Point = { x: 0, y: 0 };
    const p1: Point = { x: 1, y: 1 };
    const p2: Point = { x: 2, y: 0 };
    const p3: Point = { x: 3, y: 1 };
    const r = segmentSampleAt(p0, p1, p2, p3, 0);
    expect(r.x).toBeCloseTo(1, 6);
    expect(r.y).toBeCloseTo(1, 6);
  });

  it('returns p2 at t=1', () => {
    const p0: Point = { x: 0, y: 0 };
    const p1: Point = { x: 1, y: 1 };
    const p2: Point = { x: 2, y: 0 };
    const p3: Point = { x: 3, y: 1 };
    const r = segmentSampleAt(p0, p1, p2, p3, 1);
    expect(r.x).toBeCloseTo(2, 6);
    expect(r.y).toBeCloseTo(0, 6);
  });

  it('interpolates monotonically between p1 and p2 for linear control points', () => {
    // Four colinear points → curve should be the straight line p1→p2 for t ∈ [0,1].
    const p0: Point = { x: 0, y: 0 };
    const p1: Point = { x: 1, y: 1 };
    const p2: Point = { x: 2, y: 2 };
    const p3: Point = { x: 3, y: 3 };
    const r = segmentSampleAt(p0, p1, p2, p3, 0.5);
    expect(r.x).toBeCloseTo(1.5, 4);
    expect(r.y).toBeCloseTo(1.5, 4);
  });
});

describe('sampleCurve', () => {
  it('returns empty array for fewer than 2 anchors', () => {
    expect(sampleCurve([], 8)).toEqual([]);
    expect(sampleCurve([{ x: 0, y: 0 }], 8)).toEqual([]);
  });

  it('passes through every anchor', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
      { x: 2, y: 0 },
      { x: 3, y: 1 },
    ];
    const samples = sampleCurve(anchors, 8);
    // First sample is the first anchor; last sample is the last anchor.
    expect(samples[0]).toEqual(anchors[0]);
    expect(samples[samples.length - 1]).toEqual(anchors[anchors.length - 1]);
    // Every anchor appears in the sample list.
    for (const a of anchors) {
      const hit = samples.find((s) => Math.abs(s.x - a.x) < 1e-6 && Math.abs(s.y - a.y) < 1e-6);
      expect(hit).toBeDefined();
    }
  });

  it('produces (n-1)*samplesPerSegment + 1 samples for n anchors', () => {
    const anchors: Point[] = [
      { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 },
    ];
    const samples = sampleCurve(anchors, 8);
    expect(samples.length).toBe(2 * 8 + 1); // 2 segments × 8 samples + 1 endpoint
  });

  it('reflects phantom endpoints (first segment tangent matches p0→p1 direction)', () => {
    // With three colinear anchors, the curve should remain on that line throughout —
    // phantom reflection makes the first/last segments tangent to the chord.
    const anchors: Point[] = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    ];
    const samples = sampleCurve(anchors, 4);
    for (const s of samples) {
      expect(s.y).toBeCloseTo(0, 6);
    }
  });

  it('produces a 2-anchor curve as a straight line', () => {
    const samples = sampleCurve([{ x: 0, y: 0 }, { x: 1, y: 1 }], 4);
    expect(samples.length).toBe(5);
    expect(samples[0]).toEqual({ x: 0, y: 0 });
    expect(samples[4]).toEqual({ x: 1, y: 1 });
    // Linear interpolation: each sample lies on y=x line.
    for (const s of samples) {
      expect(s.y).toBeCloseTo(s.x, 6);
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/mike/src/weasel/.claude/worktrees/curve-editor
npx vitest run packages/ui/src/components/CurveEditor/catmullRom.test.ts 2>&1 | tail -10
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement catmullRom.ts**

Create `packages/ui/src/components/CurveEditor/catmullRom.ts`:

```ts
/**
 * Centripetal Catmull-Rom spline sampling. Yuksel/Schneider 2011
 * parameterization (α = 0.5) — passes exactly through every anchor,
 * avoids cusps and self-intersections that uniform Catmull-Rom
 * produces on sharp angles in 2D.
 */

export interface Point {
  x: number;
  y: number;
}

const ALPHA = 0.5;

/** Knot distance between two points, raised to α. The defining quantity
 *  of centripetal Catmull-Rom — uniform uses 1, chordal uses |Δ|^1. */
function knot(a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.pow(Math.sqrt(dx * dx + dy * dy), ALPHA);
}

/**
 * Sample the centripetal Catmull-Rom segment between p1 and p2 at
 * parameter t ∈ [0, 1]. p0 and p3 are the surrounding control points
 * (use phantom reflection at endpoints — see sampleCurve below).
 *
 * Returns p1 at t=0 and p2 at t=1. Uses the standard four-point
 * pyramid formulation; closed-form, no allocations beyond the return.
 */
export function segmentSampleAt(
  p0: Point, p1: Point, p2: Point, p3: Point, t: number,
): Point {
  const t0 = 0;
  const t1 = t0 + knot(p0, p1);
  const t2 = t1 + knot(p1, p2);
  const t3 = t2 + knot(p2, p3);

  // Degenerate cases — coincident points produce zero knot intervals.
  // Fall back to linear interpolation between p1 and p2 to avoid NaN.
  if (t2 - t1 === 0) {
    return { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t };
  }

  const u = t1 + t * (t2 - t1);

  // Pyramid: A-level, B-level, C (the output).
  const a1x = ((t1 - u) * p0.x + (u - t0) * p1.x) / (t1 - t0);
  const a1y = ((t1 - u) * p0.y + (u - t0) * p1.y) / (t1 - t0);
  const a2x = ((t2 - u) * p1.x + (u - t1) * p2.x) / (t2 - t1);
  const a2y = ((t2 - u) * p1.y + (u - t1) * p2.y) / (t2 - t1);
  const a3x = ((t3 - u) * p2.x + (u - t2) * p3.x) / (t3 - t2);
  const a3y = ((t3 - u) * p2.y + (u - t2) * p3.y) / (t3 - t2);

  const b1x = ((t2 - u) * a1x + (u - t0) * a2x) / (t2 - t0);
  const b1y = ((t2 - u) * a1y + (u - t0) * a2y) / (t2 - t0);
  const b2x = ((t3 - u) * a2x + (u - t1) * a3x) / (t3 - t1);
  const b2y = ((t3 - u) * a2y + (u - t1) * a3y) / (t3 - t1);

  const cx = ((t2 - u) * b1x + (u - t1) * b2x) / (t2 - t1);
  const cy = ((t2 - u) * b1y + (u - t1) * b2y) / (t2 - t1);
  return { x: cx, y: cy };
}

/**
 * Sample the whole curve through `anchors`. Returns
 * `(n-1) * samplesPerSegment + 1` points — start anchor, then
 * samplesPerSegment-1 interior samples per segment, plus the segment's
 * end anchor. Phantom endpoints by reflection so the first/last
 * segments are tangent to the chord into/out of the endpoints.
 *
 * Returns `[]` for fewer than 2 anchors (nothing to draw).
 */
export function sampleCurve(
  anchors: readonly Point[],
  samplesPerSegment: number,
): Point[] {
  if (anchors.length < 2) return [];
  if (samplesPerSegment < 1) samplesPerSegment = 1;

  const n = anchors.length;
  const out: Point[] = [];

  // Phantom endpoints by reflection: P_{-1} = 2*P_0 - P_1,
  // P_{n} = 2*P_{n-1} - P_{n-2}.
  const reflectStart: Point = {
    x: 2 * anchors[0].x - anchors[1].x,
    y: 2 * anchors[0].y - anchors[1].y,
  };
  const reflectEnd: Point = {
    x: 2 * anchors[n - 1].x - anchors[n - 2].x,
    y: 2 * anchors[n - 1].y - anchors[n - 2].y,
  };

  for (let i = 0; i < n - 1; i++) {
    const p0 = i === 0 ? reflectStart : anchors[i - 1];
    const p1 = anchors[i];
    const p2 = anchors[i + 1];
    const p3 = i + 2 < n ? anchors[i + 2] : reflectEnd;
    // For the first segment, include t=0 (anchor[0]).
    // For interior/last segments, skip t=0 (it's the previous segment's
    // t=1) to avoid duplicates.
    const tStart = i === 0 ? 0 : 1;
    for (let s = tStart; s <= samplesPerSegment; s++) {
      const t = s / samplesPerSegment;
      out.push(segmentSampleAt(p0, p1, p2, p3, t));
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run packages/ui/src/components/CurveEditor/catmullRom.test.ts 2>&1 | tail -5
```

Expected: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/CurveEditor/catmullRom.ts packages/ui/src/components/CurveEditor/catmullRom.test.ts
git commit -m "feat(weasel-ui/CurveEditor): centripetal Catmull-Rom sampling"
```

---

## Task 2: Geometry — coordinate transforms and hit tests

**Files:**
- Create: `packages/ui/src/components/CurveEditor/geometry.ts`
- Create: `packages/ui/src/components/CurveEditor/geometry.test.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/ui/src/components/CurveEditor/geometry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  modelToPlot, plotToModel, hitTestAnchor, hitTestCurve,
  type ModelRange, type PlotSize, type Point,
} from './geometry';

const M: ModelRange = { xMin: 0, xMax: 1, yMin: 0, yMax: 1 };
const P: PlotSize = { width: 200, height: 100 };

describe('modelToPlot / plotToModel', () => {
  it('maps (0,0) to bottom-left of plot', () => {
    const p = modelToPlot({ x: 0, y: 0 }, M, P);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(100, 6); // y inverted (model y goes up; plot y goes down)
  });

  it('maps (1,1) to top-right of plot', () => {
    const p = modelToPlot({ x: 1, y: 1 }, M, P);
    expect(p.x).toBeCloseTo(200, 6);
    expect(p.y).toBeCloseTo(0, 6);
  });

  it('round-trips model → plot → model', () => {
    const m = { x: 0.37, y: 0.62 };
    const p = modelToPlot(m, M, P);
    const m2 = plotToModel(p, M, P);
    expect(m2.x).toBeCloseTo(m.x, 10);
    expect(m2.y).toBeCloseTo(m.y, 10);
  });

  it('handles non-unit ranges', () => {
    const M2: ModelRange = { xMin: -5, xMax: 5, yMin: 0, yMax: 100 };
    const p = modelToPlot({ x: 0, y: 50 }, M2, P);
    expect(p.x).toBeCloseTo(100, 6); // center of plot width
    expect(p.y).toBeCloseTo(50, 6);  // center of plot height
  });
});

describe('hitTestAnchor', () => {
  const anchors: Point[] = [
    { x: 10, y: 10 }, { x: 50, y: 20 }, { x: 100, y: 50 },
  ];

  it('returns index when pointer is within radius', () => {
    const hit = hitTestAnchor(anchors, { x: 12, y: 12 }, 5);
    expect(hit).toEqual({ index: 0 });
  });

  it('returns null when pointer is outside radius', () => {
    expect(hitTestAnchor(anchors, { x: 200, y: 200 }, 5)).toBeNull();
  });

  it('returns nearest anchor when multiple are within radius', () => {
    // Pointer at (51, 21) — within radius of anchor 1 only.
    const hit = hitTestAnchor(anchors, { x: 51, y: 21 }, 10);
    expect(hit).toEqual({ index: 1 });
  });
});

describe('hitTestCurve', () => {
  // Two segments of a polyline: [(0,0)-(100,0)] then [(100,0)-(100,100)].
  const segments: Point[][] = [
    [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }],
    [{ x: 100, y: 0 }, { x: 100, y: 50 }, { x: 100, y: 100 }],
  ];

  it('returns segIdx+t for a point on the first segment', () => {
    const hit = hitTestCurve(segments, { x: 25, y: 0 }, 3);
    expect(hit).not.toBeNull();
    expect(hit!.segIdx).toBe(0);
    expect(hit!.t).toBeCloseTo(0.25, 1);
  });

  it('returns segIdx+t for a point on the second segment', () => {
    const hit = hitTestCurve(segments, { x: 100, y: 25 }, 3);
    expect(hit).not.toBeNull();
    expect(hit!.segIdx).toBe(1);
    expect(hit!.t).toBeCloseTo(0.25, 1);
  });

  it('returns null when pointer is far from the curve', () => {
    expect(hitTestCurve(segments, { x: 200, y: 200 }, 3)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/ui/src/components/CurveEditor/geometry.test.ts 2>&1 | tail -5
```

Expected: all tests fail (module not found).

- [ ] **Step 3: Implement geometry.ts**

Create `packages/ui/src/components/CurveEditor/geometry.ts`:

```ts
/**
 * Coordinate transforms (model ↔ plot) and pointer hit tests for the
 * CurveEditor. All functions are pure and deterministic — no DOM, no
 * React, no state.
 *
 * Model space: caller-defined xRange × yRange. Y axis goes UP.
 * Plot space: 0..width × 0..height in CSS pixels. Y axis goes DOWN (SVG).
 */

export interface Point {
  x: number;
  y: number;
}

export interface ModelRange {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface PlotSize {
  width: number;
  height: number;
}

export function modelToPlot(p: Point, m: ModelRange, plot: PlotSize): Point {
  const xFrac = (p.x - m.xMin) / (m.xMax - m.xMin);
  const yFrac = (p.y - m.yMin) / (m.yMax - m.yMin);
  return {
    x: xFrac * plot.width,
    y: (1 - yFrac) * plot.height, // flip Y: model up → plot down
  };
}

export function plotToModel(p: Point, m: ModelRange, plot: PlotSize): Point {
  const xFrac = p.x / plot.width;
  const yFrac = 1 - p.y / plot.height;
  return {
    x: m.xMin + xFrac * (m.xMax - m.xMin),
    y: m.yMin + yFrac * (m.yMax - m.yMin),
  };
}

/**
 * Nearest-anchor hit test. Anchors are already in plot/screen coords.
 * Returns the index of the nearest anchor whose squared distance to the
 * pointer is ≤ radius². Null if no anchor is within radius.
 */
export function hitTestAnchor(
  anchors: readonly Point[],
  pointer: Point,
  radius: number,
): { index: number } | null {
  const r2 = radius * radius;
  let best: { index: number; d2: number } | null = null;
  for (let i = 0; i < anchors.length; i++) {
    const a = anchors[i];
    const dx = a.x - pointer.x;
    const dy = a.y - pointer.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    if (best === null || d2 < best.d2) best = { index: i, d2 };
  }
  return best ? { index: best.index } : null;
}

/**
 * Hit test against a per-segment sampled polyline. Each entry in
 * `segments` is the dense sample list for one segment (inclusive of
 * endpoints). Returns segment index + t (∈ [0, 1]) of the closest
 * sample within radius. Null if no sample is in range.
 *
 * Approximate — uses sample density for closest-point calculation
 * rather than analytic curve nearest-point. Sample density in v1
 * (16/segment) gives ~6% positional precision at typical scales.
 */
export function hitTestCurve(
  segments: readonly (readonly Point[])[],
  pointer: Point,
  radius: number,
): { segIdx: number; t: number } | null {
  const r2 = radius * radius;
  let best: { segIdx: number; t: number; d2: number } | null = null;
  for (let segIdx = 0; segIdx < segments.length; segIdx++) {
    const samples = segments[segIdx];
    if (samples.length < 2) continue;
    for (let i = 0; i < samples.length; i++) {
      const s = samples[i];
      const dx = s.x - pointer.x;
      const dy = s.y - pointer.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > r2) continue;
      const t = i / (samples.length - 1);
      if (best === null || d2 < best.d2) best = { segIdx, t, d2 };
    }
  }
  return best ? { segIdx: best.segIdx, t: best.t } : null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run packages/ui/src/components/CurveEditor/geometry.test.ts 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/CurveEditor/geometry.ts packages/ui/src/components/CurveEditor/geometry.test.ts
git commit -m "feat(weasel-ui/CurveEditor): geometry transforms and hit tests"
```

---

## Task 3: Op factory — setCurveOp for weasel-history

**Files:**
- Create: `packages/ui/src/components/CurveEditor/setCurveOp.ts`
- Create: `packages/ui/src/components/CurveEditor/setCurveOp.test.ts`

**Context:** The Op shape comes from `@weasel-js/core` (the main package re-exports it). Mirror the shape used in `src/core/ops/setPath.ts`: `apply(adapter)` calls a typed adapter method; `invert()` returns a mirror op with `from`/`to` swapped. The `coalesceKey` field is optional; passes through invert.

- [ ] **Step 1: Write failing tests**

Create `packages/ui/src/components/CurveEditor/setCurveOp.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSetCurveOp, type SetCurveAdapter } from './setCurveOp';
import type { ControlPoint } from './CurveEditor';

const FROM: ControlPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
const TO: ControlPoint[] = [{ x: 0, y: 0 }, { x: 0.5, y: 0.7 }, { x: 1, y: 1 }];

describe('createSetCurveOp', () => {
  it('apply calls adapter.setValue with `to`', () => {
    const setValue = vi.fn();
    const adapter: SetCurveAdapter = { setValue };
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO });
    op.apply(adapter);
    expect(setValue).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenCalledWith('c1', TO);
  });

  it('invert produces a mirror op with from/to swapped', () => {
    const setValue = vi.fn();
    const adapter: SetCurveAdapter = { setValue };
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO });
    op.invert().apply(adapter);
    expect(setValue).toHaveBeenCalledWith('c1', FROM);
  });

  it('label round-trips through invert', () => {
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO, label: 'Edit curve' });
    expect(op.label).toBe('Edit curve');
    expect(op.invert().label).toBe('Edit curve');
  });

  it('coalesceKey round-trips through invert', () => {
    const op = createSetCurveOp({ id: 'c1', from: FROM, to: TO, coalesceKey: 'curve:c1' });
    expect(op.coalesceKey).toBe('curve:c1');
    expect(op.invert().coalesceKey).toBe('curve:c1');
  });

  it('reports a no-op when from === to (structural equality)', () => {
    const same: ControlPoint[] = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const op = createSetCurveOp({ id: 'c1', from: same, to: same.map((p) => ({ ...p })) });
    const result = op.apply({ setValue: vi.fn() });
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/ui/src/components/CurveEditor/setCurveOp.test.ts 2>&1 | tail -5
```

Expected: all tests fail (module not found — `setCurveOp.ts` and `CurveEditor.tsx` don't exist yet).

- [ ] **Step 3: Stub the ControlPoint type so setCurveOp compiles**

Create `packages/ui/src/components/CurveEditor/CurveEditor.tsx` with a placeholder export:

```tsx
// Placeholder — full implementation in Task 4. Exposes the ControlPoint
// type that setCurveOp depends on.

export interface ControlPoint {
  x: number;
  y: number;
}

export interface CurveEditorProps {
  value: readonly ControlPoint[];
  onChange: (next: ControlPoint[]) => void;
  width: number;
  height: number;
}

export function CurveEditor(_props: CurveEditorProps) {
  return null;
}
```

- [ ] **Step 4: Implement setCurveOp.ts**

Create `packages/ui/src/components/CurveEditor/setCurveOp.ts`:

```ts
import type { Op } from '@weasel-js/core';
import type { ControlPoint } from './CurveEditor';

/**
 * The adapter contract for {@link createSetCurveOp}. Consumers wire
 * this to whatever state container holds the curve's value — typically
 * a small callback that calls `setValue` on a React state setter or
 * dispatches a Redux/Zustand action.
 */
export interface SetCurveAdapter {
  setValue(id: string, next: readonly ControlPoint[]): void;
}

export interface CreateSetCurveOpArgs {
  /** Stable id the consumer uses for this curve. Used so a single
   *  adapter can handle multiple curves; the op's apply routes by id. */
  id: string;
  from: readonly ControlPoint[];
  to: readonly ControlPoint[];
  label?: string;
  coalesceKey?: string;
}

/**
 * Op factory for editing a CurveEditor's value through weasel-history.
 *
 *     history.applyOps(
 *       [createSetCurveOp({ id: 'easing', from, to, label: 'Edit easing' })],
 *       'Edit easing',
 *     );
 *
 * The op's `apply(adapter)` calls `adapter.setValue(id, to)`. `invert()`
 * returns a mirror op with `from`/`to` swapped. When `from` and `to`
 * are structurally equal, `apply` returns `false` so history can skip
 * the entry — same convention as `createSetPathOp`.
 */
export function createSetCurveOp(args: CreateSetCurveOpArgs): Op {
  const { id, from, to, label, coalesceKey } = args;
  return {
    name: 'setCurve',
    args: { id, from, to, label, coalesceKey },
    label,
    coalesceKey,
    apply(adapter) {
      (adapter as SetCurveAdapter).setValue(id, to);
      if (controlPointsEqual(from, to)) return false;
      return undefined;
    },
    invert() {
      return createSetCurveOp({ id, from: to, to: from, label, coalesceKey });
    },
  };
}

function controlPointsEqual(
  a: readonly ControlPoint[],
  b: readonly ControlPoint[],
): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].y !== b[i].y) return false;
  }
  return true;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run packages/ui/src/components/CurveEditor/setCurveOp.test.ts 2>&1 | tail -5
```

Expected: all 5 tests pass.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/CurveEditor/setCurveOp.ts packages/ui/src/components/CurveEditor/setCurveOp.test.ts packages/ui/src/components/CurveEditor/CurveEditor.tsx
git commit -m "feat(weasel-ui/CurveEditor): setCurveOp factory for weasel-history"
```

---

## Task 4: CurveEditor skeleton — rendering only

**Files:**
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.tsx`
- Create: `packages/ui/src/components/CurveEditor/CurveEditor.module.css`
- Create: `packages/ui/src/components/CurveEditor/CurveEditor.test.tsx`

**Goal:** Render the curve + anchors. No interaction yet. Subsequent tasks layer drag, add/delete, endpoints.

- [ ] **Step 1: Write failing rendering test**

Create `packages/ui/src/components/CurveEditor/CurveEditor.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

describe('CurveEditor — rendering', () => {
  it('renders an SVG with the configured width and height', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.getAttribute('width')).toBe('200');
    expect(svg!.getAttribute('height')).toBe('100');
  });

  it('renders one circle per control point', () => {
    const value: ControlPoint[] = [
      { x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 },
    ];
    const { container } = render(
      <CurveEditor value={value} onChange={() => {}} width={200} height={100} />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles.length).toBe(3);
  });

  it('renders a path element for the curve when there are >= 2 anchors', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const path = container.querySelector('path');
    expect(path).not.toBeNull();
    expect(path!.getAttribute('d')).toMatch(/^M/);
  });

  it('renders no path when fewer than 2 anchors', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0.5, y: 0.5 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    expect(container.querySelector('path')).toBeNull();
    expect(container.querySelectorAll('circle').length).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx 2>&1 | tail -10
```

Expected: 4 tests fail.

- [ ] **Step 3: Implement the skeleton component**

Replace `packages/ui/src/components/CurveEditor/CurveEditor.tsx`:

```tsx
import { useMemo, type CSSProperties } from 'react';
import { sampleCurve, type Point } from './catmullRom';
import { modelToPlot, type ModelRange } from './geometry';
import s from './CurveEditor.module.css';

export interface ControlPoint {
  x: number;
  y: number;
}

export type CurveDomain = '1d' | '2d';
export type EndpointMode = 'free' | 'pinned-x' | 'pinned-both';
export type AddPointMode = 'click-curve' | 'click-empty' | 'never';

export interface CurveEditorProps {
  /** Anchor points; caller-owned. */
  value: readonly ControlPoint[];
  /** Fires every frame during drag with the live in-flight value. */
  onChange: (next: ControlPoint[]) => void;
  /** Fires once per discrete user action (drag-end, add, delete) with
   *  the new value and the value at gesture start. Wire history here. */
  onChangeCommit?: (next: ControlPoint[], prev: readonly ControlPoint[]) => void;
  /** 1D function (monotonic in x) or 2D path. Default '2d'. */
  domain?: CurveDomain;
  /** Endpoint constraint mode. Default 'free'. */
  endpoints?: EndpointMode;
  /** Model-space x range. Default [0, 1]. */
  xRange?: readonly [number, number];
  /** Model-space y range. Default [0, 1]. */
  yRange?: readonly [number, number];
  /** Plot width in CSS pixels. */
  width: number;
  /** Plot height in CSS pixels. */
  height: number;
  /** Show a background grid. */
  showGrid?: boolean;
  /** Show axis lines + tick marks. */
  showAxes?: boolean;
  /** How new anchors are added. Default 'click-curve'. */
  addPointMode?: AddPointMode;
  /** Extra class on the root SVG element. */
  className?: string;
  /** Inline style on the root SVG element. */
  style?: CSSProperties;
}

const SAMPLES_PER_SEGMENT = 16;

export function CurveEditor(props: CurveEditorProps) {
  const {
    value, width, height,
    xRange = [0, 1],
    yRange = [0, 1],
    className,
    style,
  } = props;

  const modelRange: ModelRange = useMemo(
    () => ({ xMin: xRange[0], xMax: xRange[1], yMin: yRange[0], yMax: yRange[1] }),
    [xRange, yRange],
  );

  const plotSize = useMemo(() => ({ width, height }), [width, height]);

  // Project anchors to plot space for both rendering and (later) hit testing.
  const plotAnchors: Point[] = useMemo(
    () => value.map((a) => modelToPlot(a, modelRange, plotSize)),
    [value, modelRange, plotSize],
  );

  // Sample the curve in MODEL space (so phantom reflection math is range-agnostic),
  // then project samples to plot space for SVG path emission.
  const pathD = useMemo(() => {
    if (value.length < 2) return '';
    const modelSamples = sampleCurve(value, SAMPLES_PER_SEGMENT);
    const plotSamples = modelSamples.map((p) => modelToPlot(p, modelRange, plotSize));
    if (plotSamples.length === 0) return '';
    const parts: string[] = [`M${plotSamples[0].x.toFixed(2)},${plotSamples[0].y.toFixed(2)}`];
    for (let i = 1; i < plotSamples.length; i++) {
      parts.push(`L${plotSamples[i].x.toFixed(2)},${plotSamples[i].y.toFixed(2)}`);
    }
    return parts.join('');
  }, [value, modelRange, plotSize]);

  const cls = [s.root, className].filter(Boolean).join(' ');

  return (
    <svg
      className={cls}
      style={style}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
    >
      {pathD && (
        <path
          className={s.curve}
          d={pathD}
          fill="none"
        />
      )}
      {plotAnchors.map((a, i) => (
        <circle
          key={i}
          className={s.anchor}
          cx={a.x}
          cy={a.y}
          r={4}
          data-anchor-index={i}
        />
      ))}
    </svg>
  );
}
```

- [ ] **Step 4: Create the CSS module**

Create `packages/ui/src/components/CurveEditor/CurveEditor.module.css`:

```css
.root {
  --curve-bg: transparent;
  --curve-grid: rgba(0, 0, 0, 0.06);
  --curve-axis: rgba(0, 0, 0, 0.3);
  --curve-line: #3478f6;
  --curve-line-width: 1.5;
  --curve-anchor-fill: #ffffff;
  --curve-anchor-stroke: #3478f6;
  --curve-anchor-radius: 4;
  --curve-anchor-active-fill: #3478f6;
  --curve-pinned-fill: #888888;

  display: block;
  background: var(--curve-bg);
  user-select: none;
  touch-action: none;
}

.grid {
  stroke: var(--curve-grid);
  stroke-width: 1;
  fill: none;
}

.axis {
  stroke: var(--curve-axis);
  stroke-width: 1;
  fill: none;
}

.curve {
  stroke: var(--curve-line);
  stroke-width: var(--curve-line-width);
  fill: none;
  pointer-events: stroke;
}

.anchor {
  fill: var(--curve-anchor-fill);
  stroke: var(--curve-anchor-stroke);
  stroke-width: 1.5;
  cursor: grab;
}

.anchor:hover {
  fill: var(--curve-anchor-active-fill);
}

.anchor.active {
  fill: var(--curve-anchor-active-fill);
  cursor: grabbing;
}

.anchor.pinned {
  fill: var(--curve-pinned-fill);
  cursor: default;
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 6: Typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/CurveEditor/CurveEditor.tsx packages/ui/src/components/CurveEditor/CurveEditor.module.css packages/ui/src/components/CurveEditor/CurveEditor.test.tsx
git commit -m "feat(weasel-ui/CurveEditor): skeleton component with curve + anchor rendering"
```

---

## Task 5: Drag interaction

**Files:**
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.tsx`
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.test.tsx`

**Goal:** Dragging an anchor moves it. `onChange` fires per pointer move; `onChangeCommit` fires once on release. In `domain='1d'`, x is clamped between left/right neighbors during drag.

- [ ] **Step 1: Add failing drag tests**

Append to `packages/ui/src/components/CurveEditor/CurveEditor.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react';

describe('CurveEditor — drag', () => {
  it('fires onChange when an anchor is dragged', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={onChange}
        width={200}
        height={100}
      />,
    );
    const circles = container.querySelectorAll('circle');
    const middle = circles[1] as Element;

    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 30, pointerId: 1 });

    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall).toHaveLength(3);
    expect(lastCall[1].x).not.toBe(0.5); // middle anchor moved
  });

  it('fires onChangeCommit once with (next, prev) on pointerup', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const initial = [{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }];
    const { container } = render(
      <CurveEditor
        value={initial}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('circle')[1] as Element;

    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 120, clientY: 30, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 120, clientY: 30, pointerId: 1 });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next, prev] = onChangeCommit.mock.calls[0];
    expect(prev).toEqual(initial);
    expect(next[1].x).not.toBe(0.5);
  });

  it('clamps x between neighbors in 1D mode', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={onChange}
        domain="1d"
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('circle')[1] as Element;
    // Try to drag middle anchor past the right neighbor (way to the right).
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // x should be clamped to <= neighbor's x (the third anchor at model x=1.0).
    expect(last[1].x).toBeLessThanOrEqual(1.0);
    // And >= left neighbor's x (model x=0).
    expect(last[1].x).toBeGreaterThanOrEqual(0);
  });

  it('does NOT clamp x in 2D mode', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={onChange}
        domain="2d"
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('circle')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 500, clientY: 50, pointerId: 1 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // In 2D, x can exceed neighbor x without clamping (no monotonicity guarantee).
    expect(last[1].x).toBeGreaterThan(1.0);
  });
});
```

Also add `import { vi } from 'vitest';` at the top if not already present.

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx 2>&1 | tail -10
```

Expected: 4 new drag tests fail.

- [ ] **Step 3: Add drag state and handlers**

Update `CurveEditor.tsx`. Add to imports at the top:

```tsx
import { useCallback, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { plotToModel } from './geometry';
```

Add inside the component body after `const plotAnchors = ...`:

```tsx
const {
  onChange, onChangeCommit,
  domain = '2d',
} = props;

// Drag state — null when idle, the dragged anchor's array index +
// the value snapshot at gesture start when active.
interface DragState {
  index: number;
  pointerId: number;
  startValue: readonly ControlPoint[];
}
const dragRef = useRef<DragState | null>(null);
const svgRef = useRef<SVGSVGElement | null>(null);

// Compute the model-space coords of a pointer event by intersecting
// with the SVG's bounding rect — guards against page scroll / CSS
// transforms on the SVG element.
const pointerToModel = useCallback((clientX: number, clientY: number): Point => {
  const rect = svgRef.current?.getBoundingClientRect();
  if (!rect) return { x: 0, y: 0 };
  const plot: Point = { x: clientX - rect.left, y: clientY - rect.top };
  return plotToModel(plot, modelRange, plotSize);
}, [modelRange, plotSize]);

const onPointerDownAnchor = useCallback((index: number, e: ReactPointerEvent<SVGCircleElement>) => {
  e.stopPropagation();
  dragRef.current = {
    index,
    pointerId: e.pointerId,
    startValue: value,
  };
  // Listen on the window so the gesture survives a fast cursor that
  // briefly leaves the SVG before returning.
  window.addEventListener('pointermove', onWindowMove);
  window.addEventListener('pointerup', onWindowUp);
  window.addEventListener('pointercancel', onWindowCancel);
}, [value]);

// These three are stable callbacks via useCallback below; defined
// outside the per-anchor onPointerDown for stability across renders.
const onWindowMove = useCallback((e: PointerEvent) => {
  const d = dragRef.current;
  if (!d || d.pointerId !== e.pointerId) return;
  const m = pointerToModel(e.clientX, e.clientY);
  const next = [...d.startValue.map((p) => ({ ...p }))];
  let nx = m.x;
  if (domain === '1d') {
    const left = d.index > 0 ? next[d.index - 1].x : -Infinity;
    const right = d.index < next.length - 1 ? next[d.index + 1].x : Infinity;
    nx = Math.max(left, Math.min(right, nx));
  }
  next[d.index] = { x: nx, y: m.y };
  onChange(next);
}, [domain, onChange, pointerToModel]);

const onWindowUp = useCallback((e: PointerEvent) => {
  const d = dragRef.current;
  if (!d || d.pointerId !== e.pointerId) return;
  // The final value is whatever `value` currently reflects (the caller's
  // commit of the last onChange). For onChangeCommit, we hand back the
  // current `value` as `next` and the captured `startValue` as `prev`.
  if (onChangeCommit) onChangeCommit([...value.map((p) => ({ ...p }))], d.startValue);
  dragRef.current = null;
  window.removeEventListener('pointermove', onWindowMove);
  window.removeEventListener('pointerup', onWindowUp);
  window.removeEventListener('pointercancel', onWindowCancel);
}, [value, onChangeCommit, onWindowMove]);

const onWindowCancel = useCallback((e: PointerEvent) => {
  const d = dragRef.current;
  if (!d || d.pointerId !== e.pointerId) return;
  // Restore the pre-drag value on cancel — no commit fires.
  onChange([...d.startValue.map((p) => ({ ...p }))]);
  dragRef.current = null;
  window.removeEventListener('pointermove', onWindowMove);
  window.removeEventListener('pointerup', onWindowUp);
  window.removeEventListener('pointercancel', onWindowCancel);
}, [onChange, onWindowMove]);
```

Update the `<svg>` element to wire the ref:

```tsx
<svg
  ref={svgRef}
  className={cls}
  style={style}
  width={width}
  height={height}
  viewBox={`0 0 ${width} ${height}`}
  role="img"
>
```

Update the `circle` rendering to wire `onPointerDown`:

```tsx
{plotAnchors.map((a, i) => (
  <circle
    key={i}
    className={s.anchor}
    cx={a.x}
    cy={a.y}
    r={4}
    data-anchor-index={i}
    onPointerDown={(e) => onPointerDownAnchor(i, e)}
  />
))}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx 2>&1 | tail -10
```

Expected: all 8 tests pass (4 from Task 4 + 4 drag tests).

If `onChangeCommit`'s "current value" semantics fail (because the caller controls value and may not have updated state by pointerup), reconsider: the test passes `onChange={onChange}` (vi.fn) which doesn't actually update value. The `onChangeCommit` is called with the LAST onChange's value, not the React state. Fix by tracking the last-onChange-payload as scratch state alongside `dragRef`:

```ts
interface DragState {
  index: number;
  pointerId: number;
  startValue: readonly ControlPoint[];
  lastNext: ControlPoint[]; // last value emitted by onChange
}
```

Update `onWindowMove` to set `d.lastNext = next` after calling onChange. Update `onWindowUp` to use `d.lastNext` instead of `value`:

```ts
if (onChangeCommit) onChangeCommit(d.lastNext, d.startValue);
```

Re-run tests until green.

- [ ] **Step 5: Typecheck**

```bash
npx tsc --noEmit 2>&1 | tail -5
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/CurveEditor/CurveEditor.tsx packages/ui/src/components/CurveEditor/CurveEditor.test.tsx
git commit -m "feat(weasel-ui/CurveEditor): drag interaction with 1D x-clamping"
```

---

## Task 6: Add and delete anchors

**Files:**
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.tsx`
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.test.tsx`

**Goal:** Per `addPointMode`, clicking adds an anchor. Shift+click on an anchor deletes it. Both fire `onChangeCommit`.

- [ ] **Step 1: Add failing tests**

Append to `CurveEditor.test.tsx`:

```tsx
describe('CurveEditor — add and delete', () => {
  it('adds an anchor on empty-plot click when addPointMode="click-empty"', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        addPointMode="click-empty"
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 2 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 50, pointerId: 2 });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next] = onChangeCommit.mock.calls[0];
    expect(next).toHaveLength(3);
  });

  it('adds an anchor on curve click when addPointMode="click-curve"', () => {
    const onChange = vi.fn();
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        onChangeCommit={onChangeCommit}
        addPointMode="click-curve"
        width={200}
        height={100}
      />,
    );
    // Click near (0.5, 0.5) in model space — on the y=x line — which
    // is on the curve for two-anchor [(0,0),(1,1)].
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 3 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 50, pointerId: 3 });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next] = onChangeCommit.mock.calls[0];
    expect(next).toHaveLength(3);
  });

  it('does not add on click when addPointMode="never"', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        addPointMode="never"
        width={200}
        height={100}
      />,
    );
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 100, clientY: 50, pointerId: 4 });
    fireEvent.pointerUp(window, { clientX: 100, clientY: 50, pointerId: 4 });

    expect(onChangeCommit).not.toHaveBeenCalled();
  });

  it('inserts at x-sorted index in 1D mode (click-empty)', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        domain="1d"
        addPointMode="click-empty"
        width={200}
        height={100}
      />,
    );
    // Click at plot (50, 50) → model (0.25, 0.5). Should insert at index 1.
    const svg = container.querySelector('svg')!;
    fireEvent.pointerDown(svg, { clientX: 50, clientY: 50, pointerId: 5 });
    fireEvent.pointerUp(window, { clientX: 50, clientY: 50, pointerId: 5 });

    const [next] = onChangeCommit.mock.calls[0];
    expect(next[1].x).toBeCloseTo(0.25, 2);
    expect(next).toHaveLength(3);
  });

  it('deletes an anchor on shift+click', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('circle')[1] as Element;
    fireEvent.pointerDown(middle, {
      clientX: 100, clientY: 50, pointerId: 6, shiftKey: true,
    });

    expect(onChangeCommit).toHaveBeenCalledTimes(1);
    const [next] = onChangeCommit.mock.calls[0];
    expect(next).toHaveLength(2);
    expect(next).toEqual([{ x: 0, y: 0 }, { x: 1, y: 1 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx -t "add and delete" 2>&1 | tail -10
```

Expected: 5 tests fail.

- [ ] **Step 3: Add add/delete logic**

Update `CurveEditor.tsx`. Update destructure:

```tsx
const {
  onChange, onChangeCommit,
  domain = '2d',
  addPointMode = 'click-curve',
} = props;
```

Update `onPointerDownAnchor` to handle shift+click as delete (before starting drag):

```tsx
const onPointerDownAnchor = useCallback((index: number, e: ReactPointerEvent<SVGCircleElement>) => {
  e.stopPropagation();
  // Shift+click → delete (skipped for pinned endpoints; handled in Task 7).
  if (e.shiftKey) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    if (onChangeCommit) onChangeCommit(next, value);
    return;
  }
  dragRef.current = {
    index,
    pointerId: e.pointerId,
    startValue: value,
    lastNext: [...value.map((p) => ({ ...p }))],
  };
  window.addEventListener('pointermove', onWindowMove);
  window.addEventListener('pointerup', onWindowUp);
  window.addEventListener('pointercancel', onWindowCancel);
}, [value, onChange, onChangeCommit, onWindowMove, onWindowUp, onWindowCancel]);
```

Add a pointerdown handler on the SVG itself for add-on-click. Build the per-segment sample lists so we can hit-test the curve:

```tsx
import { hitTestCurve } from './geometry';

// Precompute per-segment plot samples for curve hit testing.
const segmentSamples = useMemo((): Point[][] => {
  if (value.length < 2) return [];
  const out: Point[][] = [];
  for (let i = 0; i < value.length - 1; i++) {
    const pair = value.slice(i, i + 2);
    const modelSamples = sampleCurve(pair, SAMPLES_PER_SEGMENT);
    out.push(modelSamples.map((p) => modelToPlot(p, modelRange, plotSize)));
  }
  return out;
}, [value, modelRange, plotSize]);

const onSvgPointerDown = useCallback((e: ReactPointerEvent<SVGSVGElement>) => {
  if (addPointMode === 'never') return;
  // Ignore if the event already targets an anchor circle (it'll handle itself).
  const target = e.target as SVGElement;
  if (target.tagName === 'circle') return;

  const rect = svgRef.current?.getBoundingClientRect();
  if (!rect) return;
  const plotPt: Point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
  const modelPt = plotToModel(plotPt, modelRange, plotSize);

  if (addPointMode === 'click-curve') {
    const hit = hitTestCurve(segmentSamples, plotPt, 8);
    if (!hit) return;
    // Insert after `hit.segIdx` (between segIdx and segIdx+1 anchor).
    const insertIndex = hit.segIdx + 1;
    const next = [...value.slice(0, insertIndex), modelPt, ...value.slice(insertIndex)];
    onChange(next);
    if (onChangeCommit) onChangeCommit(next, value);
    return;
  }

  // 'click-empty' — insert anywhere on the plot.
  let insertIndex = value.length;
  if (domain === '1d') {
    // Maintain x-sort order.
    for (let i = 0; i < value.length; i++) {
      if (value[i].x > modelPt.x) { insertIndex = i; break; }
    }
  }
  const next = [...value.slice(0, insertIndex), modelPt, ...value.slice(insertIndex)];
  onChange(next);
  if (onChangeCommit) onChangeCommit(next, value);
}, [addPointMode, value, modelRange, plotSize, segmentSamples, domain, onChange, onChangeCommit]);
```

Update the `<svg>` element to wire `onPointerDown={onSvgPointerDown}`.

- [ ] **Step 4: Run tests**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx 2>&1 | tail -10
```

Expected: all tests pass (4 rendering + 4 drag + 5 add/delete = 13).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/CurveEditor/CurveEditor.tsx packages/ui/src/components/CurveEditor/CurveEditor.test.tsx
git commit -m "feat(weasel-ui/CurveEditor): add and delete anchors"
```

---

## Task 7: Endpoint constraints

**Files:**
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.tsx`
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.test.tsx`

**Goal:** `endpoints='pinned-x'` locks first/last anchors' x to xRange edges; y is editable. `endpoints='pinned-both'` locks first/last to the corners. Pinned endpoints can't be deleted.

- [ ] **Step 1: Add failing tests**

Append to `CurveEditor.test.tsx`:

```tsx
describe('CurveEditor — endpoint constraints', () => {
  it('pinned-x: first anchor x locked to xRange[0]', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        endpoints="pinned-x"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('circle')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 0, clientY: 100, pointerId: 7 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 30, pointerId: 7 });

    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].x).toBe(0);   // x clamped to xRange[0]
    expect(last[0].y).not.toBe(0); // y is editable
  });

  it('pinned-both: first anchor locked to corner', () => {
    const onChange = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={onChange}
        endpoints="pinned-both"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('circle')[0] as Element;
    fireEvent.pointerDown(first, { clientX: 0, clientY: 100, pointerId: 8 });
    fireEvent.pointerMove(window, { clientX: 60, clientY: 30, pointerId: 8 });

    // No onChange should fire — first anchor can't move at all in pinned-both.
    // (Or it fires but with unchanged endpoint.)
    if (onChange.mock.calls.length > 0) {
      const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(last[0].x).toBe(0);
      expect(last[0].y).toBe(0);
    }
  });

  it('pinned endpoints cannot be deleted via shift+click', () => {
    const onChangeCommit = vi.fn();
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        onChangeCommit={onChangeCommit}
        endpoints="pinned-x"
        width={200}
        height={100}
      />,
    );
    const first = container.querySelectorAll('circle')[0] as Element;
    fireEvent.pointerDown(first, {
      clientX: 0, clientY: 100, pointerId: 9, shiftKey: true,
    });
    expect(onChangeCommit).not.toHaveBeenCalled();
  });

  it('renders pinned endpoints with the pinned visual class', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        endpoints="pinned-both"
        width={200}
        height={100}
      />,
    );
    const circles = container.querySelectorAll('circle');
    expect(circles[0].className.baseVal).toMatch(/pinned/);
    expect(circles[2].className.baseVal).toMatch(/pinned/);
    expect(circles[1].className.baseVal).not.toMatch(/pinned/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx -t "endpoint constraints" 2>&1 | tail -10
```

Expected: 4 tests fail.

- [ ] **Step 3: Implement endpoint logic**

Update `CurveEditor.tsx`. Update destructure:

```tsx
const {
  onChange, onChangeCommit,
  domain = '2d',
  endpoints = 'free',
  addPointMode = 'click-curve',
} = props;
```

Add a helper to determine if an index is a pinned endpoint:

```tsx
const isPinnedEndpoint = useCallback((index: number): boolean => {
  if (endpoints === 'free') return false;
  return index === 0 || index === value.length - 1;
}, [endpoints, value.length]);
```

In `onPointerDownAnchor`, refuse deletion of pinned endpoints:

```tsx
if (e.shiftKey) {
  if (isPinnedEndpoint(index)) return;
  const next = value.filter((_, i) => i !== index);
  onChange(next);
  if (onChangeCommit) onChangeCommit(next, value);
  return;
}
```

In `onWindowMove`, apply endpoint clamping after computing the new model point:

```tsx
const onWindowMove = useCallback((e: PointerEvent) => {
  const d = dragRef.current;
  if (!d || d.pointerId !== e.pointerId) return;
  const m = pointerToModel(e.clientX, e.clientY);
  const next = [...d.startValue.map((p) => ({ ...p }))];
  let nx = m.x;
  let ny = m.y;

  // Endpoint clamping.
  if (endpoints === 'pinned-x' && (d.index === 0 || d.index === next.length - 1)) {
    nx = d.index === 0 ? modelRange.xMin : modelRange.xMax;
  } else if (endpoints === 'pinned-both' && (d.index === 0 || d.index === next.length - 1)) {
    nx = d.index === 0 ? modelRange.xMin : modelRange.xMax;
    ny = d.index === 0 ? modelRange.yMin : modelRange.yMax;
  } else if (domain === '1d') {
    const left = d.index > 0 ? next[d.index - 1].x : -Infinity;
    const right = d.index < next.length - 1 ? next[d.index + 1].x : Infinity;
    nx = Math.max(left, Math.min(right, nx));
  }

  next[d.index] = { x: nx, y: ny };
  d.lastNext = next;
  onChange(next);
}, [domain, endpoints, modelRange, onChange, pointerToModel]);
```

Update the anchor rendering to apply the pinned class:

```tsx
{plotAnchors.map((a, i) => {
  const pinned = isPinnedEndpoint(i);
  const cls = [s.anchor, pinned && s.pinned].filter(Boolean).join(' ');
  return (
    <circle
      key={i}
      className={cls}
      cx={a.x}
      cy={a.y}
      r={4}
      data-anchor-index={i}
      onPointerDown={(e) => onPointerDownAnchor(i, e)}
    />
  );
})}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx 2>&1 | tail -10
```

Expected: all 17 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/CurveEditor/CurveEditor.tsx packages/ui/src/components/CurveEditor/CurveEditor.test.tsx
git commit -m "feat(weasel-ui/CurveEditor): endpoint constraints (pinned-x, pinned-both)"
```

---

## Task 8: Grid, axes, and active anchor styling

**Files:**
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.tsx`
- Modify: `packages/ui/src/components/CurveEditor/CurveEditor.test.tsx`

**Goal:** `showGrid` and `showAxes` props render visual chrome. Active (being-dragged) anchor gets the `active` class.

- [ ] **Step 1: Add failing tests**

Append to `CurveEditor.test.tsx`:

```tsx
describe('CurveEditor — visual chrome', () => {
  it('renders grid lines when showGrid is true', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        showGrid
        width={200}
        height={100}
      />,
    );
    const gridLines = container.querySelectorAll('[data-curve-element="grid"]');
    expect(gridLines.length).toBeGreaterThan(0);
  });

  it('renders axis lines when showAxes is true', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        showAxes
        width={200}
        height={100}
      />,
    );
    const axes = container.querySelectorAll('[data-curve-element="axis"]');
    expect(axes.length).toBe(2); // x and y axis
  });

  it('marks the dragged anchor with the active class', () => {
    const { container } = render(
      <CurveEditor
        value={[{ x: 0, y: 0 }, { x: 0.5, y: 0.5 }, { x: 1, y: 1 }]}
        onChange={() => {}}
        width={200}
        height={100}
      />,
    );
    const middle = container.querySelectorAll('circle')[1] as Element;
    fireEvent.pointerDown(middle, { clientX: 100, clientY: 50, pointerId: 10 });
    // After pointerdown, the middle circle should carry the active class.
    expect(middle.className.baseVal).toMatch(/active/);
    fireEvent.pointerUp(window, { clientX: 100, clientY: 50, pointerId: 10 });
    expect(middle.className.baseVal).not.toMatch(/active/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx -t "visual chrome" 2>&1 | tail -10
```

Expected: 3 tests fail.

- [ ] **Step 3: Add grid / axes rendering**

Update `CurveEditor.tsx`. Add an `activeDragIndex` state so the rendered active circle can update:

```tsx
const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null);
```

Set it in `onPointerDownAnchor` (after the shift+click delete branch):

```tsx
setActiveDragIndex(index);
```

Clear it in `onWindowUp` and `onWindowCancel`:

```tsx
setActiveDragIndex(null);
```

Add grid/axes rendering. Insert before the curve `path` element in the JSX:

```tsx
{props.showGrid && (
  <g>
    {[0.25, 0.5, 0.75].map((f) => (
      <line
        key={`gx-${f}`}
        data-curve-element="grid"
        className={s.grid}
        x1={f * width} x2={f * width}
        y1={0} y2={height}
      />
    ))}
    {[0.25, 0.5, 0.75].map((f) => (
      <line
        key={`gy-${f}`}
        data-curve-element="grid"
        className={s.grid}
        x1={0} x2={width}
        y1={f * height} y2={f * height}
      />
    ))}
  </g>
)}
{props.showAxes && (
  <g>
    <line
      data-curve-element="axis"
      className={s.axis}
      x1={0} x2={width}
      y1={height} y2={height}
    />
    <line
      data-curve-element="axis"
      className={s.axis}
      x1={0} x2={0}
      y1={0} y2={height}
    />
  </g>
)}
```

Update the anchor rendering to apply `active` class:

```tsx
{plotAnchors.map((a, i) => {
  const pinned = isPinnedEndpoint(i);
  const active = activeDragIndex === i;
  const cls = [s.anchor, pinned && s.pinned, active && s.active].filter(Boolean).join(' ');
  return (
    <circle
      key={i}
      className={cls}
      cx={a.x}
      cy={a.y}
      r={4}
      data-anchor-index={i}
      onPointerDown={(e) => onPointerDownAnchor(i, e)}
    />
  );
})}
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run packages/ui/src/components/CurveEditor/CurveEditor.test.tsx 2>&1 | tail -10
```

Expected: all 20 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/CurveEditor/CurveEditor.tsx packages/ui/src/components/CurveEditor/CurveEditor.test.tsx
git commit -m "feat(weasel-ui/CurveEditor): grid, axes, active-anchor styling"
```

---

## Task 9: Storybook stories and package export

**Files:**
- Create: `packages/ui/src/components/CurveEditor/index.ts`
- Create: `packages/ui/src/components/CurveEditor/CurveEditor.stories.tsx`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Create the local barrel export**

Create `packages/ui/src/components/CurveEditor/index.ts`:

```ts
export {
  CurveEditor,
  type CurveEditorProps,
  type ControlPoint,
  type CurveDomain,
  type EndpointMode,
  type AddPointMode,
} from './CurveEditor';

export {
  createSetCurveOp,
  type SetCurveAdapter,
  type CreateSetCurveOpArgs,
} from './setCurveOp';
```

- [ ] **Step 2: Add to the package's public exports**

Edit `packages/ui/src/index.ts` and append after the last existing `export *` line:

```ts
export * from './components/CurveEditor';
```

- [ ] **Step 3: Write Storybook stories**

Create `packages/ui/src/components/CurveEditor/CurveEditor.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { CurveEditor, type ControlPoint } from './CurveEditor';

const meta: Meta<typeof CurveEditor> = {
  title: 'weasel-ui/CurveEditor',
  component: CurveEditor,
};
export default meta;

type Story = StoryObj<typeof CurveEditor>;

function Interactive(props: {
  initial: ControlPoint[];
  domain?: '1d' | '2d';
  endpoints?: 'free' | 'pinned-x' | 'pinned-both';
  width?: number;
  height?: number;
  showGrid?: boolean;
  showAxes?: boolean;
}) {
  const [value, setValue] = useState(props.initial);
  return (
    <CurveEditor
      value={value}
      onChange={setValue}
      domain={props.domain}
      endpoints={props.endpoints}
      width={props.width ?? 400}
      height={props.height ?? 200}
      showGrid={props.showGrid}
      showAxes={props.showAxes}
    />
  );
}

export const EasingCurve: Story = {
  render: () => (
    <Interactive
      initial={[{ x: 0, y: 0 }, { x: 0.3, y: 0.1 }, { x: 0.7, y: 0.9 }, { x: 1, y: 1 }]}
      domain="1d"
      endpoints="pinned-both"
      showGrid
      showAxes
    />
  ),
};

export const TwoDimPath: Story = {
  render: () => (
    <Interactive
      initial={[{ x: 0.1, y: 0.5 }, { x: 0.3, y: 0.8 }, { x: 0.7, y: 0.2 }, { x: 0.9, y: 0.5 }]}
      domain="2d"
      endpoints="free"
      showGrid
    />
  ),
};

export const PinnedX: Story = {
  render: () => (
    <Interactive
      initial={[{ x: 0, y: 0.3 }, { x: 0.5, y: 0.7 }, { x: 1, y: 0.4 }]}
      domain="1d"
      endpoints="pinned-x"
      showAxes
    />
  ),
};

export const Empty: Story = {
  render: () => (
    <Interactive
      initial={[]}
      domain="2d"
      endpoints="free"
      showGrid
    />
  ),
};
```

- [ ] **Step 4: Typecheck and run full test suite**

```bash
npx tsc --noEmit 2>&1 | tail -5
npx vitest run 2>&1 | tail -10
```

Expected: typecheck clean; weasel-ui test count rises by ~30 (20 CurveEditor + 8 catmullRom + 11 geometry + 5 setCurveOp) above the 331 baseline.

- [ ] **Step 5: Run prepublishOnly to confirm CI gate**

```bash
npm run prepublishOnly 2>&1 | tail -15
```

Expected: green (tsc + vitest + tsup + typedoc all pass).

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/CurveEditor/index.ts packages/ui/src/components/CurveEditor/CurveEditor.stories.tsx packages/ui/src/index.ts
git commit -m "feat(weasel-ui/CurveEditor): Storybook stories and package exports"
```

---

## Notes for the executor

- **TDD throughout.** Each task starts with failing tests, then implements until green. Don't skip writing the tests first — the test list IS the spec for that task.
- **Storybook manual smoke.** After Task 9, start Storybook (`npm run dev:storybook` from repo root) and exercise each story. Drag anchors, add/delete, verify endpoint constraints. No automated visual test; this is the human-loop check.
- **The `weasel-history` integration is consumer-only.** Don't wire weasel-history inside CurveEditor itself — the `setCurveOp` factory is exported so consumers can plug it into their history. There's no kit-side test that exercises end-to-end "drag → undo entry"; that lives in whatever consumer adopts the component.
- **Don't change Slider or other existing weasel-ui components.** This plan adds a new component sibling; it shouldn't touch the others.
- **The `controlPointsEqual` function in `setCurveOp.ts` only handles flat ControlPoint arrays.** If a future ControlPoint shape grows (extra fields like `smooth?: boolean`), update the equality check.
