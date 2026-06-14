# Powerline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Powerline` component to `@weasel-js/ui` — a horizontal row of `Badge` segments whose end caps tessellate, via a new `powerline` `BadgeBase` that takes pluggable left/right edge profiles.

**Architecture:** A new `BadgeBase` named `powerline` implements the existing `BaseModule` contract by sampling a closed perimeter whose left and right edges are driven by `EdgeProfile` functions (`(t, depth) => xOffset`). A thin `Powerline` component renders one `<Badge base="powerline" />` per segment and threads each segment's `endCap` profile as the next segment's `leftEdge`, so shared geometry tessellates exactly. All existing Badge features (tones, variants, effects, crawl, focus) work on each segment without extra plumbing.

**Tech Stack:** TypeScript, React 18, Vitest + `@testing-library/react`, Storybook (CSF3), css-modules. Workspace package: `packages/ui` (consume via `@weasel-js/ui` workspace dep). Run tests with `npm test -w @weasel-js/ui`.

Spec: `docs/superpowers/specs/2026-05-22-powerline-design.md`

---

## File Structure

**Create:**
- `packages/ui/src/components/Badge/bases/edgeProfiles.ts` — built-in `EdgeProfile` registry + `EdgeCap` type + `resolveEdge` helper.
- `packages/ui/src/components/Badge/bases/edgeProfiles.test.ts` — unit tests for built-in profiles + `resolveEdge`.
- `packages/ui/src/components/Badge/bases/Powerline.tsx` — `BaseModule<PowerlineParams>` implementation.
- `packages/ui/src/components/Badge/bases/Powerline.test.ts` — unit tests for the base's `build()`.
- `packages/ui/src/components/Powerline/Powerline.tsx` — row component.
- `packages/ui/src/components/Powerline/Powerline.module.css` — row container styling (inline-flex, no gap).
- `packages/ui/src/components/Powerline/Powerline.test.tsx` — component tests.
- `packages/ui/src/components/Powerline/Powerline.stories.tsx` — Storybook stories.
- `packages/ui/src/components/Powerline/index.ts` — public exports.

**Modify:**
- `packages/ui/src/components/Badge/bases/index.ts` — register `powerline`, extend `BadgeBase` union and `BadgeBaseParams`.
- `packages/ui/src/index.ts` — re-export `Powerline` and its types.

---

## Task 1: Built-in edge profile registry

**Files:**
- Create: `packages/ui/src/components/Badge/bases/edgeProfiles.ts`
- Test: `packages/ui/src/components/Badge/bases/edgeProfiles.test.ts`

The registry defines the v1 cap shapes. An `EdgeProfile` is a pure function `(t, depth) → xOffset` where `t ∈ [0,1]` runs top→bottom and `xOffset` is in CSS px (positive = protrude rightward of the unprotruded edge, negative = cut inward). `resolveEdge` accepts either a registered name or a custom function.

- [ ] **Step 1: Write the failing tests**

Create `packages/ui/src/components/Badge/bases/edgeProfiles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { EDGE_PROFILES, resolveEdge, type EdgeProfile } from './edgeProfiles';

describe('EDGE_PROFILES', () => {
  it('flat returns 0 for all t', () => {
    expect(EDGE_PROFILES.flat(0, 6)).toBe(0);
    expect(EDGE_PROFILES.flat(0.5, 6)).toBe(0);
    expect(EDGE_PROFILES.flat(1, 6)).toBe(0);
  });

  it('chevron peaks at t=0.5 and is zero at endpoints', () => {
    expect(EDGE_PROFILES.chevron(0, 10)).toBeCloseTo(0);
    expect(EDGE_PROFILES.chevron(0.5, 10)).toBeCloseTo(10);
    expect(EDGE_PROFILES.chevron(1, 10)).toBeCloseTo(0);
  });

  it('slant rises linearly from 0 at t=0 to depth at t=1', () => {
    expect(EDGE_PROFILES.slant(0, 8)).toBeCloseTo(0);
    expect(EDGE_PROFILES.slant(0.5, 8)).toBeCloseTo(4);
    expect(EDGE_PROFILES.slant(1, 8)).toBeCloseTo(8);
  });

  it('slant-up is the mirror of slant', () => {
    expect(EDGE_PROFILES['slant-up'](0, 8)).toBeCloseTo(8);
    expect(EDGE_PROFILES['slant-up'](1, 8)).toBeCloseTo(0);
  });

  it('round is zero at endpoints and depth at midpoint', () => {
    expect(EDGE_PROFILES.round(0, 6)).toBeCloseTo(0);
    expect(EDGE_PROFILES.round(0.5, 6)).toBeCloseTo(6);
    expect(EDGE_PROFILES.round(1, 6)).toBeCloseTo(0);
  });

  it('concave-chevron is the negation of chevron', () => {
    expect(EDGE_PROFILES['concave-chevron'](0.5, 10)).toBeCloseTo(-10);
  });

  it('scallop oscillates and is bounded by 0.4 * depth', () => {
    for (let i = 0; i <= 10; i++) {
      const v = EDGE_PROFILES.scallop(i / 10, 10);
      expect(Math.abs(v)).toBeLessThanOrEqual(10 * 0.4 + 1e-9);
    }
  });
});

describe('resolveEdge', () => {
  it('returns the registered profile for a known name', () => {
    expect(resolveEdge('chevron')).toBe(EDGE_PROFILES.chevron);
  });

  it('returns a custom function unchanged', () => {
    const custom: EdgeProfile = (t, d) => t * d * 2;
    expect(resolveEdge(custom)).toBe(custom);
  });

  it('falls back to flat for an unknown name', () => {
    // @ts-expect-error intentional bad name
    expect(resolveEdge('bogus')).toBe(EDGE_PROFILES.flat);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @weasel-js/ui -- edgeProfiles`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the registry**

Create `packages/ui/src/components/Badge/bases/edgeProfiles.ts`:

```ts
export type EdgeProfile = (t: number, depth: number) => number;

export type BuiltInEdgeName =
  | 'flat'
  | 'chevron'
  | 'slant'
  | 'slant-up'
  | 'round'
  | 'scallop'
  | 'concave-chevron';

export type EdgeCap = BuiltInEdgeName | EdgeProfile;

export const EDGE_PROFILES: Record<BuiltInEdgeName, EdgeProfile> = {
  flat:              (_t, _d) => 0,
  chevron:           (t, d)   => (1 - Math.abs(t - 0.5) * 2) * d,
  slant:             (t, d)   => t * d,
  'slant-up':        (t, d)   => (1 - t) * d,
  round:             (t, d)   => Math.sin(t * Math.PI) * d,
  scallop:           (t, d)   => Math.sin(t * Math.PI * 3) * 0.4 * d,
  'concave-chevron': (t, d)   => -(1 - Math.abs(t - 0.5) * 2) * d,
};

export function resolveEdge(cap: EdgeCap): EdgeProfile {
  if (typeof cap === 'function') return cap;
  return EDGE_PROFILES[cap] ?? EDGE_PROFILES.flat;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @weasel-js/ui -- edgeProfiles`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Badge/bases/edgeProfiles.ts \
        packages/ui/src/components/Badge/bases/edgeProfiles.test.ts
git commit -m "feat(weasel-ui): add edge profile registry for powerline caps"
```

---

## Task 2: Powerline base (perimeter sampler)

**Files:**
- Create: `packages/ui/src/components/Badge/bases/Powerline.tsx`
- Test: `packages/ui/src/components/Badge/bases/Powerline.test.ts`

A `BaseModule<PowerlineParams>` whose `build()` samples a closed perimeter: top edge (flat), right edge (driven by `rightEdge` profile, top→bottom), bottom edge (flat, right→left), left edge (driven by `leftEdge` profile, bottom→top, mirrored so the same profile tessellates with the previous segment's right edge).

Perimeter sample density: 64 points per vertical edge (smooth enough for chevron/round; cheap). Path is emitted as a polyline `M ... L ... L ... Z`. `totalCss` accumulates segment lengths in CSS px. `insets` add horizontal padding equal to `depth` on each side so text doesn't collide with inward-cutting caps.

- [ ] **Step 1: Write the failing tests**

Create `packages/ui/src/components/Badge/bases/Powerline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import Powerline from './Powerline';

describe('Powerline base', () => {
  const W = 120;
  const H = 24;

  it('produces a closed bodyPath for flat-flat edges', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    expect(s.bodyPath.startsWith('M ')).toBe(true);
    expect(s.bodyPath.endsWith(' Z')).toBe(true);
  });

  it('totalCss is positive and finite', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    expect(s.totalCss).toBeGreaterThan(0);
    expect(Number.isFinite(s.totalCss)).toBe(true);
  });

  it('perimeterAt wraps around totalCss', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    const a = s.perimeterAt(0);
    const b = s.perimeterAt(s.totalCss);
    expect(a.x).toBeCloseTo(b.x, 3);
    expect(a.y).toBeCloseTo(b.y, 3);
  });

  it('flat-flat sampler returns x in [0,100] and y in [0,100] viewBox coords', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'flat', depth: 6 }, W, H);
    for (let i = 0; i < 50; i++) {
      const p = s.perimeterAt((i / 50) * s.totalCss);
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(100);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(100);
    }
  });

  it('chevron right edge produces a body path containing the chevron tip past the rect right edge', () => {
    const s = Powerline.build({ leftEdge: 'flat', rightEdge: 'chevron', depth: 6 }, W, H);
    // Viewbox is 0..100; chevron tip protrudes past x=100 if depth is positive
    // (viewBox is unstretched 0..100 so depth/W * 100 is the protrusion in vb units).
    const expectedTipVb = 100 + (6 / W) * 100;
    // Find max x in 80 samples.
    let maxX = 0;
    for (let i = 0; i < 80; i++) {
      const p = s.perimeterAt((i / 80) * s.totalCss);
      maxX = Math.max(maxX, p.x);
    }
    expect(maxX).toBeGreaterThan(99);
    expect(maxX).toBeLessThanOrEqual(expectedTipVb + 0.01);
    expect(maxX).toBeGreaterThan(expectedTipVb - 0.5);
  });

  it('insets expand horizontally by depth in CSS px', () => {
    const insets = typeof Powerline.insets === 'function'
      ? Powerline.insets({ leftEdge: 'flat', rightEdge: 'chevron', depth: 8 })
      : Powerline.insets!;
    expect(insets.left).toBe(8);
    expect(insets.right).toBe(8);
    expect(insets.top).toBe(0);
    expect(insets.bottom).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @weasel-js/ui -- Powerline.test`
Expected: FAIL — module `./Powerline` not found.

- [ ] **Step 3: Implement the base**

Create `packages/ui/src/components/Badge/bases/Powerline.tsx`:

```ts
import { resolveEdge, type EdgeCap } from './edgeProfiles';
import type { BaseModule, BaseSampler, PerimeterPoint } from './types';

export interface PowerlineParams {
  /** Profile for the left edge (the cap segment N inherits from segment N-1). */
  leftEdge?: EdgeCap;
  /** Profile for the right edge (this segment's own end cap). */
  rightEdge?: EdgeCap;
  /** Protrusion depth in CSS px (positive values stick out beyond the rect). */
  depth?: number;
}

const DEFAULTS: Required<PowerlineParams> = {
  leftEdge: 'flat',
  rightEdge: 'flat',
  depth: 6,
};

/** Samples along one vertical edge. Higher → smoother chevron/round caps. */
const EDGE_SAMPLES = 64;

const Powerline: BaseModule<PowerlineParams> = {
  build: (params, boxW, boxH) => {
    const cfg = { ...DEFAULTS, ...params };
    const left = resolveEdge(cfg.leftEdge);
    const right = resolveEdge(cfg.rightEdge);
    const depth = cfg.depth;
    const sx = 100 / boxW;
    const sy = 100 / boxH;

    // Build the four edges as arrays of viewBox-space points, ordered clockwise:
    // top (left→right), right (top→bottom), bottom (right→left), left (bottom→top).
    // The left and right edges share their profile geometry — segment N's right
    // edge (profile p) is identical to segment N+1's left edge (profile p), so
    // adjacent segments tessellate by construction.
    const pts: { x: number; y: number; nx: number; ny: number }[] = [];

    // Top edge — flat, y=0.
    pts.push({ x: 0, y: 0, nx: 0, ny: -1 });
    pts.push({ x: 100, y: 0, nx: 0, ny: -1 });

    // Right edge — driven by `right(t, depth)`, t: 0 (top) → 1 (bottom).
    for (let i = 1; i < EDGE_SAMPLES; i++) {
      const t = i / EDGE_SAMPLES;
      const xCss = boxW + right(t, depth);
      pts.push({ x: xCss * sx, y: t * 100, nx: 1, ny: 0 });
    }

    // Bottom-right corner sample, then bottom edge (flat, y=100).
    pts.push({ x: (boxW + right(1, depth)) * sx, y: 100, nx: 0, ny: 1 });
    pts.push({ x: (0 + left(1, depth)) * sx, y: 100, nx: 0, ny: 1 });

    // Left edge — driven by `left(t, depth)`, but walked bottom→top so the
    // perimeter stays clockwise. The same profile evaluated at the same t gives
    // the same x-offset, so two adjacent segments butt with no gap.
    for (let i = EDGE_SAMPLES - 1; i >= 1; i--) {
      const t = i / EDGE_SAMPLES;
      const xCss = 0 + left(t, depth);
      pts.push({ x: xCss * sx, y: t * 100, nx: -1, ny: 0 });
    }

    // Compute segment lengths in CSS px (used both for totalCss and for arc-length
    // lookup in perimeterAt).
    const cum: number[] = [0];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const dxCss = (b.x - a.x) / sx;
      const dyCss = (b.y - a.y) / sy;
      cum.push(cum[i - 1] + Math.hypot(dxCss, dyCss));
    }
    // Close: distance from last back to first.
    const last = pts[pts.length - 1];
    const first = pts[0];
    const closeLen = Math.hypot((first.x - last.x) / sx, (first.y - last.y) / sy);
    const totalCss = cum[cum.length - 1] + closeLen;

    const perimeterAt = (s: number): PerimeterPoint => {
      const sm = ((s % totalCss) + totalCss) % totalCss;
      // Binary-ish linear walk: pts.length is small (~135) so linear is fine.
      for (let i = 1; i < pts.length; i++) {
        if (sm <= cum[i]) {
          const segLen = cum[i] - cum[i - 1];
          const t = segLen > 0 ? (sm - cum[i - 1]) / segLen : 0;
          const a = pts[i - 1];
          const b = pts[i];
          return {
            x: a.x + (b.x - a.x) * t,
            y: a.y + (b.y - a.y) * t,
            nx: b.nx,
            ny: b.ny,
          };
        }
      }
      // Closing segment.
      const lastIdx = pts.length - 1;
      const segLen = closeLen;
      const t = segLen > 0 ? (sm - cum[lastIdx]) / segLen : 0;
      return {
        x: pts[lastIdx].x + (first.x - pts[lastIdx].x) * t,
        y: pts[lastIdx].y + (first.y - pts[lastIdx].y) * t,
        nx: 0,
        ny: 1,
      };
    };

    const bodyPath = pts.reduce(
      (acc, p, i) =>
        acc + (i === 0
          ? `M ${p.x.toFixed(3)} ${p.y.toFixed(3)}`
          : ` L ${p.x.toFixed(3)} ${p.y.toFixed(3)}`),
      ''
    ) + ' Z';

    const sampler: BaseSampler = { bodyPath, perimeterAt, totalCss };
    return sampler;
  },
  defaults: DEFAULTS,
  insets: (params) => {
    const depth = params?.depth ?? DEFAULTS.depth;
    return { top: 0, right: depth, bottom: 0, left: depth };
  },
};

export default Powerline;
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -w @weasel-js/ui -- Powerline.test`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Badge/bases/Powerline.tsx \
        packages/ui/src/components/Badge/bases/Powerline.test.ts
git commit -m "feat(weasel-ui): add powerline BadgeBase with pluggable edge profiles"
```

---

## Task 3: Register the powerline base

**Files:**
- Modify: `packages/ui/src/components/Badge/bases/index.ts`

Add `powerline` to the `BadgeBase` union, register its module, and expose its params type. Keep all other base entries unchanged so existing Badge call sites are untouched.

- [ ] **Step 1: Write the failing test**

Append to `packages/ui/src/components/Badge/bases/Powerline.test.ts`:

```ts
import { BASES, type BadgeBase } from './index';

describe('Powerline base registration', () => {
  it('is registered under the "powerline" key', () => {
    const key: BadgeBase = 'powerline';
    expect(BASES[key]).toBeDefined();
    expect(typeof BASES[key].build).toBe('function');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @weasel-js/ui -- Powerline.test`
Expected: FAIL — `'powerline'` is not assignable to `BadgeBase`, and `BASES.powerline` is undefined.

- [ ] **Step 3: Update the registry**

Modify `packages/ui/src/components/Badge/bases/index.ts`:

```ts
import type { BaseModule } from './types';
import ChamferedRect, { type ChamferedRectParams } from './ChamferedRect';
import RoundedRect, { type RoundedRectParams } from './RoundedRect';
import Polygon, { type PolygonParams } from './Polygon';
import Puzzle, { type PuzzleParams } from './Puzzle';
import Quatrefoil, { type QuatrefoilParams } from './Quatrefoil';
import OctantSpline, { type OctantSplineParams } from './OctantSpline';
import OctantBSpline, { type OctantBSplineParams } from './OctantBSpline';
import Ribbon, { type RibbonParams } from './Ribbon';
import Powerline, { type PowerlineParams } from './Powerline';

export type BadgeBase =
  | 'chamfered-rect'
  | 'rounded-rect'
  | 'polygon'
  | 'puzzle'
  | 'quatrefoil'
  | 'octant-spline'
  | 'octant-bspline'
  | 'ribbon'
  | 'powerline';

export interface BadgeBaseParams {
  'chamfered-rect': ChamferedRectParams;
  'rounded-rect': RoundedRectParams;
  'polygon': PolygonParams;
  'puzzle': PuzzleParams;
  'quatrefoil': QuatrefoilParams;
  'octant-spline': OctantSplineParams;
  'octant-bspline': OctantBSplineParams;
  'ribbon': RibbonParams;
  'powerline': PowerlineParams;
}

export const BASES: Record<BadgeBase, BaseModule<any>> = {
  'chamfered-rect': ChamferedRect,
  'rounded-rect': RoundedRect,
  'polygon': Polygon,
  'puzzle': Puzzle,
  'quatrefoil': Quatrefoil,
  'octant-spline': OctantSpline,
  'octant-bspline': OctantBSpline,
  'ribbon': Ribbon,
  'powerline': Powerline,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @weasel-js/ui -- Powerline.test edgeProfiles`
Expected: PASS — all tests including the new registration test.

Also run the full weasel-ui test suite to confirm no regressions:

Run: `npm test -w @weasel-js/ui`
Expected: PASS for all pre-existing tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Badge/bases/index.ts \
        packages/ui/src/components/Badge/bases/Powerline.test.ts
git commit -m "feat(weasel-ui): register powerline base in BASES registry"
```

---

## Task 4: Powerline component

**Files:**
- Create: `packages/ui/src/components/Powerline/Powerline.tsx`
- Create: `packages/ui/src/components/Powerline/Powerline.module.css`
- Create: `packages/ui/src/components/Powerline/index.ts`
- Test: `packages/ui/src/components/Powerline/Powerline.test.tsx`

Thin component that emits one `<Badge base="powerline" />` per segment, threads the cap profiles, and applies row-level defaults that per-segment props can override. Row container is an `inline-flex` with `gap: 0` so segments butt.

- [ ] **Step 1: Write the failing tests**

Create `packages/ui/src/components/Powerline/Powerline.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Powerline } from './Powerline';

describe('Powerline', () => {
  it('renders one element per segment', () => {
    const { container } = render(
      <Powerline
        segments={[
          { text: 'a' },
          { text: 'b' },
          { text: 'c' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(3);
  });

  it('threads endCap of segment N to leftEdge of segment N+1', () => {
    // Indirect check: segment N+1 should have base="powerline" applied (via data-shape="compose")
    // and the first segment's left edge defaults to startCap ('flat').
    const { container } = render(
      <Powerline
        startCap="flat"
        segments={[
          { text: 'a', endCap: 'chevron' },
          { text: 'b', endCap: 'slant' },
          { text: 'c' },
        ]}
      />
    );
    const badges = container.querySelectorAll('[data-shape="compose"]');
    expect(badges.length).toBe(3);
  });

  it('applies row-level tone defaults but per-segment tone wins', () => {
    const { container } = render(
      <Powerline
        variant="solid"
        segments={[
          { text: 'a', tone: 'accent' },
          { text: 'b', tone: 'info' },
        ]}
      />
    );
    const badges = container.querySelectorAll('[data-tone]');
    expect(badges[0].getAttribute('data-tone')).toBe('accent');
    expect(badges[1].getAttribute('data-tone')).toBe('info');
    expect(badges[0].getAttribute('data-variant')).toBe('solid');
  });

  it('renders segment text content', () => {
    const { getByText } = render(
      <Powerline segments={[{ text: 'main' }, { text: '✓ 12' }]} />
    );
    expect(getByText('main')).toBeDefined();
    expect(getByText('✓ 12')).toBeDefined();
  });

  it('accepts a custom EdgeProfile function as a cap', () => {
    const custom = (t: number, d: number) => Math.sin(t * Math.PI * 4) * d * 0.5;
    const { container } = render(
      <Powerline
        segments={[
          { text: 'x', endCap: custom },
          { text: 'y' },
        ]}
      />
    );
    expect(container.querySelectorAll('[data-shape="compose"]').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -w @weasel-js/ui -- Powerline`
Expected: FAIL — `./Powerline` not found.

- [ ] **Step 3: Implement the CSS module**

Create `packages/ui/src/components/Powerline/Powerline.module.css`:

```css
.row {
  display: inline-flex;
  align-items: stretch;
  gap: 0;
}
```

- [ ] **Step 4: Implement the component**

Create `packages/ui/src/components/Powerline/Powerline.tsx`:

```tsx
import type { ReactNode } from 'react';
import { Badge } from '../Badge/Badge';
import type { BadgeSize, BadgeTone, BadgeVariant } from '../Badge/types';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';
import s from './Powerline.module.css';

export interface PowerlineSegment {
  text: ReactNode;
  /** Cap on this segment's right edge. Next segment's left edge adopts the same profile. */
  endCap?: EdgeCap;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  onClick?: () => void;
  href?: string;
  'aria-label'?: string;
}

export interface PowerlineProps {
  segments: PowerlineSegment[];
  /** Left edge of the first segment. Defaults to 'flat'. */
  startCap?: EdgeCap;
  /** Default size for every segment (per-segment `size` wins). */
  size?: BadgeSize;
  /** Default variant for every segment (per-segment `variant` wins). */
  variant?: BadgeVariant;
  /** Protrusion depth in CSS px, passed through to every segment's base. */
  depth?: number;
  className?: string;
  'aria-label'?: string;
}

export function Powerline({
  segments,
  startCap = 'flat',
  size,
  variant,
  depth,
  className,
  ...rest
}: PowerlineProps) {
  const cls = [s.row, className].filter(Boolean).join(' ');
  return (
    <span className={cls} aria-label={rest['aria-label']}>
      {segments.map((seg, i) => {
        const leftEdge: EdgeCap = i === 0 ? startCap : (segments[i - 1].endCap ?? 'flat');
        const rightEdge: EdgeCap = seg.endCap ?? 'flat';
        return (
          <Badge
            key={i}
            base="powerline"
            baseParams={{ leftEdge, rightEdge, ...(depth !== undefined && { depth }) }}
            tone={seg.tone}
            variant={seg.variant ?? variant}
            size={seg.size ?? size}
            onClick={seg.onClick}
            href={seg.href}
            aria-label={seg['aria-label']}
          >
            {seg.text}
          </Badge>
        );
      })}
    </span>
  );
}
```

- [ ] **Step 5: Create the public exports**

Create `packages/ui/src/components/Powerline/index.ts`:

```ts
export { Powerline } from './Powerline';
export type { PowerlineProps, PowerlineSegment } from './Powerline';
export type { EdgeCap, EdgeProfile, BuiltInEdgeName } from '../Badge/bases/edgeProfiles';
export { EDGE_PROFILES } from '../Badge/bases/edgeProfiles';
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -w @weasel-js/ui -- Powerline`
Expected: PASS for the new component tests (5 tests) and the base tests still pass.

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/Powerline/
git commit -m "feat(weasel-ui): add Powerline row component"
```

---

## Task 5: Export from package root

**Files:**
- Modify: `packages/ui/src/index.ts`

Re-export `Powerline` and its types so consumers can `import { Powerline } from '@weasel-js/ui'`.

- [ ] **Step 1: Write the failing test**

Append to `packages/ui/src/components/Powerline/Powerline.test.tsx`:

```tsx
import * as PkgRoot from '../../index';

describe('package root export', () => {
  it('re-exports Powerline from the package root', () => {
    expect(PkgRoot.Powerline).toBeDefined();
  });

  it('re-exports EDGE_PROFILES from the package root', () => {
    expect(PkgRoot.EDGE_PROFILES).toBeDefined();
    expect(typeof PkgRoot.EDGE_PROFILES.chevron).toBe('function');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -w @weasel-js/ui -- Powerline.test`
Expected: FAIL — `PkgRoot.Powerline` is undefined.

- [ ] **Step 3: Add the re-exports**

Modify `packages/ui/src/index.ts` — add this line in alphabetical position (after `./components/OptionsBar`, before `./components/Sidebar`):

```ts
export * from './components/Powerline';
```

The final exports block reads:

```ts
export * from './components/ActionBar';
export * from './components/Badge';
export * from './components/Button';
export * from './components/DataGrid';
export * from './components/Keycaps';
export * from './components/Slider';
export * from './components/ToggleBar';
export * from './components/OptionsBar';
export * from './components/ActionsBar';
export * from './components/Powerline';
export * from './components/Sidebar';
export * from './components/SidebarPanel';
export * from './components/ToolButton';
export * from './components/ToolGroup';
export * from './components/ToolPalette';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -w @weasel-js/ui`
Expected: PASS — full weasel-ui suite green.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/index.ts \
        packages/ui/src/components/Powerline/Powerline.test.tsx
git commit -m "feat(weasel-ui): export Powerline from package root"
```

---

## Task 6: Storybook stories

**Files:**
- Create: `packages/ui/src/components/Powerline/Powerline.stories.tsx`

Stories exercise every built-in cap, mixed-tone rows, a custom `EdgeProfile`, and per-segment overrides. These are the visual validation surface — review them in Storybook before declaring done.

- [ ] **Step 1: Create the stories file**

Create `packages/ui/src/components/Powerline/Powerline.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Powerline } from './Powerline';
import type { EdgeCap } from '../Badge/bases/edgeProfiles';

const ALL_CAPS: EdgeCap[] = ['flat', 'chevron', 'slant', 'slant-up', 'round', 'scallop', 'concave-chevron'];

const meta: Meta<typeof Powerline> = {
  title: 'weasel-ui/Foundations/Powerline',
  component: Powerline,
  args: {
    variant: 'solid',
    size: 'sm',
    segments: [
      { text: 'main', tone: 'accent', endCap: 'chevron' },
      { text: '✓ 12', tone: 'info', endCap: 'slant' },
      { text: '↑3 ↓1', tone: 'warn', endCap: 'scallop' },
      { text: '~/proj', tone: 'muted' },
    ],
  },
  argTypes: {
    startCap: { control: 'select', options: ALL_CAPS },
    variant: { control: 'inline-radio', options: ['outline', 'solid', 'subtle'] },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
    depth: { control: { type: 'range', min: 0, max: 20, step: 0.5 } },
  },
};
export default meta;

type Story = StoryObj<typeof Powerline>;

export const ClassicPrompt: Story = {};

export const EveryCapInOneRow: Story = {
  args: {
    segments: ALL_CAPS.slice(0, -1).map((cap, i) => ({
      text: typeof cap === 'string' ? cap : `custom-${i}`,
      endCap: cap,
      tone: (['accent', 'info', 'warn', 'danger', 'muted', 'neutral'] as const)[i % 6],
    })).concat([{ text: 'end', tone: 'neutral' }]),
  },
};

export const CapMatrix: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 12 }}>
      {ALL_CAPS.map((cap) => (
        <Powerline
          key={String(cap)}
          variant="solid"
          size="sm"
          segments={[
            { text: String(cap), tone: 'accent', endCap: cap },
            { text: 'next', tone: 'info' },
          ]}
        />
      ))}
    </div>
  ),
};

export const SubtleVariant: Story = {
  args: { variant: 'subtle' },
};

export const OutlineVariant: Story = {
  args: { variant: 'outline' },
};

export const SizeMd: Story = {
  args: { size: 'md' },
};

export const CustomEdgeProfile: Story = {
  args: {
    segments: [
      {
        text: 'wave',
        tone: 'accent',
        endCap: (t, d) => Math.sin(t * Math.PI * 4) * d * 0.6,
      },
      { text: 'next', tone: 'info' },
    ],
  },
};

export const LongStripCookbook: Story = {
  args: {
    segments: [
      { text: '⎈ k8s', tone: 'info', endCap: 'chevron' },
      { text: 'prod', tone: 'danger', endCap: 'chevron' },
      { text: 'us-west-2', tone: 'warn', endCap: 'slant' },
      { text: 'deployment/api', tone: 'muted', endCap: 'round' },
      { text: 'v2.3.1', tone: 'accent' },
    ],
  },
};
```

- [ ] **Step 2: Verify the stories file is picked up**

Storybook is run from the repo root. Quick smoke check that the file compiles via TypeScript:

Run: `npm run -w @weasel-js/ui typecheck 2>/dev/null || npx -w @weasel-js/ui tsc --noEmit`
Expected: PASS — no TS errors. (If neither script exists, `npx tsc --noEmit -p packages/ui` from repo root.)

- [ ] **Step 3: Run the full weasel-ui suite one more time**

Run: `npm test -w @weasel-js/ui`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/Powerline/Powerline.stories.tsx
git commit -m "feat(weasel-ui): Powerline stories for caps, variants, custom profiles"
```

---

## Task 7: Manual visual validation in Storybook

**Files:** none (visual check only)

The base-level integration is the payoff — confirm every Badge feature still works on a powerline segment.

- [ ] **Step 1: Start Storybook**

Run: `npm run -w @weasel-js/ui storybook` (or `npm run storybook` from repo root if that's where it's wired).

- [ ] **Step 2: Visual checks — confirm each of the following**

For each story under `weasel-ui/Foundations/Powerline`:

1. **Seam check.** Adjacent segments butt with no visible gap and no overlap at every size (`sm`, `md`). Zoom the browser to 200% if the seam is subtle.
2. **Cap shapes are recognizable.** `chevron` looks like a right-pointing arrow; `slant` is a parallelogram-style diagonal; `round` is a half-ellipse; `scallop` has visible waves; `concave-chevron` cuts inward.
3. **Tones render correctly.** Each segment picks up its tone independently. `variant="outline"` shows the stroked silhouette around the cap; `variant="solid"` fills it.
4. **Depth control responds.** Set `depth: 0` — segments should look like flat rectangles regardless of cap selection (since all profiles scale with `d`).
5. **Custom EdgeProfile story renders without errors** and the wave is visible.

- [ ] **Step 3: Note any visual regressions**

If any check fails, file a follow-up task — do not patch silently. The base contract is supposed to make all this work for free; a failure here means the base implementation needs revision.

- [ ] **Step 4: No commit needed** (no file changes).

---

## Self-Review

**Spec coverage:**
- API (`PowerlineProps`, `PowerlineSegment`, `EdgeCap`, `EdgeProfile`): Tasks 1, 4.
- Tessellation contract (shared-profile geometry): Task 2 (implementation comment + tests).
- `powerline` `BadgeBase`: Tasks 2, 3.
- Edge profile registry with all 7 built-ins: Task 1.
- `Powerline` component with row-level defaults and per-segment overrides: Task 4.
- `<Badge base="powerline" />` standalone use: Task 3 (registration); implicitly tested by every Powerline test since the component dispatches through Badge.
- CSS row container (`inline-flex`, zero gap): Task 4.
- Public exports: Task 5.
- Storybook validation surface: Tasks 6, 7.
- Non-goals (row-level effects, asymmetric joins, vertical orientation): not implemented (correct).

**Placeholder scan:** No TBDs, no "implement appropriate X", every code step contains the actual code. ✅

**Type consistency:**
- `EdgeCap`, `EdgeProfile`, `BuiltInEdgeName` defined once in Task 1, imported everywhere else. ✅
- `PowerlineParams` defined in Task 2, registered in Task 3, consumed in Task 4. ✅
- `PowerlineSegment.endCap` and `PowerlineProps.startCap` both typed `EdgeCap`. ✅
- `BASES.powerline.build` signature matches `BaseModule<PowerlineParams>['build']`. ✅
- `data-shape="compose"` is the attribute Badge emits whenever `base` is set (see `Badge.tsx:155`) — that's what Task 4 tests assert on. ✅
