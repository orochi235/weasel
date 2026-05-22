# Animated Vertex Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add tween/spring/cycle/stagger helpers for per-anchor path vertex colors, plus an OKLCH color-space option, without mutating scene `data`.

**Architecture:** New `ColorOverrideRegistry` attached to `useAnimator`. The renderer's `createPathLayer` consults the registry before reading the consumer's `getVertexColors` / `getStrokeVertexColors` accessors. Helpers in a new `src/animation/colorHelpers.ts` mirror the shape of `tweenPose` / `springPose`.

**Tech Stack:** TypeScript, Vitest, `@testing-library/react` for hooks, existing weasel animation primitives (`useAnimator`, `Animator.tween/spring/loop/stagger`), pure OKLab color math (Björn Ottosson's reference matrices).

**Spec:** `docs/superpowers/specs/2026-05-21-animated-vertex-colors-design.md`

**Notes for the implementer:**
- Vertex colors throughout the kit are `number[]` (flat RGBA bytes 0–255), **not** `Uint8Array`. Match the existing convention. The spec referenced `Uint8Array` in passing — ignore that and use `number[]` everywhere.
- Length is always `4 × countPathAnchors(path)` for both fill and stroke arrays.
- All existing animation tests inject a `makeClock()` and advance virtual time with `clock.advance(ms)`. See `src/animation/poseHelpers.test.ts` for the canonical pattern.
- The GL mesh cache (`src/renderer/cache/GLMeshCache.ts`) is `WeakMap`-keyed by mesh object identity. Per-frame color arrays change identity naturally, so no explicit cache-bypass is needed — the spec's concern was unfounded after inspection.

---

## File Structure

**Created:**
- `src/animation/colorSpaces.ts` — pure sRGB↔OKLab math, `lerpColorArray`.
- `src/animation/colorSpaces.test.ts`
- `src/animation/colorRegistry.ts` — `ColorOverrideRegistry` class.
- `src/animation/colorRegistry.test.ts`
- `src/animation/colorHelpers.ts` — `tweenVertexColors`, `springVertexColors`, `cycleVertexColors`, `staggerVertexColors`.
- `src/animation/colorHelpers.test.ts`

**Modified:**
- `src/animation/types.ts` — add `colorOverrides: ColorOverrideRegistry` to `Animator`.
- `src/animation/useAnimator.ts` — instantiate registry; expose; clear on unmount.
- `src/animation/index.ts` — re-exports.
- `src/index.ts` — re-export from `./animation` (already a barrel; no change needed unless `*` doesn't capture new exports — verify).
- `src/features/paths/pathLayer.ts` — accept `colorOverrides?` option; consult before reading accessors.
- `demo/demos/BezierEditDemo.tsx` — add tween/cycle/stagger demo controls.

---

## Task 1: Color spaces — sRGB ↔ OKLab math

**Files:**
- Create: `src/animation/colorSpaces.ts`
- Test: `src/animation/colorSpaces.test.ts`

- [ ] **Step 1: Write failing test for sRGB→OKLab round-trip**

Create `src/animation/colorSpaces.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { srgbU8ToOklab, oklabToSrgbU8, lerpOklab, lerpColorArray } from './colorSpaces';

describe('srgbU8 ↔ Oklab', () => {
  it('round-trips every byte triple within ±1 per channel', () => {
    const samples: Array<[number, number, number]> = [
      [0, 0, 0], [255, 255, 255], [128, 128, 128],
      [255, 0, 0], [0, 255, 0], [0, 0, 255],
      [200, 100, 50], [17, 234, 91], [255, 254, 253],
    ];
    for (const [r, g, b] of samples) {
      const [L, A, B] = srgbU8ToOklab(r, g, b);
      const [r2, g2, b2] = oklabToSrgbU8(L, A, B);
      expect(Math.abs(r2 - r)).toBeLessThanOrEqual(1);
      expect(Math.abs(g2 - g)).toBeLessThanOrEqual(1);
      expect(Math.abs(b2 - b)).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/colorSpaces.test.ts`
Expected: FAIL — `Cannot find module './colorSpaces'`.

- [ ] **Step 3: Implement colorSpaces.ts (sRGB↔linear LUT + OKLab matrices)**

Create `src/animation/colorSpaces.ts`:

```ts
// sRGB ↔ OKLab conversion. Reference: https://bottosson.github.io/posts/oklab/

// Precomputed sRGB-byte → linear LUT (length 256).
const SRGB_TO_LINEAR: Float64Array = (() => {
  const lut = new Float64Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    lut[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return lut;
})();

function linearToSrgbByte(c: number): number {
  if (c <= 0) return 0;
  if (c >= 1) return 255;
  const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.round(v * 255);
}

export function srgbU8ToOklab(r: number, g: number, b: number): [number, number, number] {
  const rl = SRGB_TO_LINEAR[r & 0xff];
  const gl = SRGB_TO_LINEAR[g & 0xff];
  const bl = SRGB_TO_LINEAR[b & 0xff];
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl;
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl;
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl;
  const lp = Math.cbrt(l);
  const mp = Math.cbrt(m);
  const sp = Math.cbrt(s);
  return [
    0.2104542553 * lp + 0.7936177850 * mp - 0.0040720468 * sp,
    1.9779984951 * lp - 2.4285922050 * mp + 0.4505937099 * sp,
    0.0259040371 * lp + 0.7827717662 * mp - 0.8086757660 * sp,
  ];
}

function oklabToLinearSrgb(L: number, A: number, B: number): [number, number, number] {
  const lp = L + 0.3963377774 * A + 0.2158037573 * B;
  const mp = L - 0.1055613458 * A - 0.0638541728 * B;
  const sp = L - 0.0894841775 * A - 1.2914855480 * B;
  const l = lp * lp * lp;
  const m = mp * mp * mp;
  const s = sp * sp * sp;
  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
  ];
}

function inGamut(rl: number, gl: number, bl: number): boolean {
  return rl >= 0 && rl <= 1 && gl >= 0 && gl <= 1 && bl >= 0 && bl <= 1;
}

/** Clip OKLab → sRGB by reducing chroma (preserving L) until in gamut.
 *  Cheap binary search, up to 5 iterations. */
function clipToGamut(L: number, A: number, B: number): [number, number, number] {
  let [rl, gl, bl] = oklabToLinearSrgb(L, A, B);
  if (inGamut(rl, gl, bl)) return [rl, gl, bl];
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 5; i++) {
    const t = (lo + hi) / 2;
    [rl, gl, bl] = oklabToLinearSrgb(L, A * t, B * t);
    if (inGamut(rl, gl, bl)) lo = t; else hi = t;
  }
  [rl, gl, bl] = oklabToLinearSrgb(L, A * lo, B * lo);
  return [rl, gl, bl];
}

export function oklabToSrgbU8(L: number, A: number, B: number): [number, number, number] {
  const [rl, gl, bl] = clipToGamut(L, A, B);
  return [linearToSrgbByte(rl), linearToSrgbByte(gl), linearToSrgbByte(bl)];
}

export function lerpOklab(
  from: readonly [number, number, number],
  to: readonly [number, number, number],
  t: number,
): [number, number, number] {
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] + (to[1] - from[1]) * t,
    from[2] + (to[2] - from[2]) * t,
  ];
}

export type ColorSpace = 'rgb' | 'oklab';

/** Lerp a flat RGBA byte array `from` toward `to`. Alpha is always linearly lerped.
 *  RGB channels are lerped in the requested color space. */
export function lerpColorArray(
  from: readonly number[],
  to: readonly number[],
  t: number,
  space: ColorSpace = 'rgb',
): number[] {
  if (from.length !== to.length) {
    throw new Error(`lerpColorArray: length mismatch (from=${from.length}, to=${to.length})`);
  }
  if (from.length % 4 !== 0) {
    throw new Error(`lerpColorArray: length ${from.length} not divisible by 4`);
  }
  const out = new Array<number>(from.length);
  const n = from.length / 4;
  if (space === 'rgb') {
    for (let i = 0; i < from.length; i++) {
      out[i] = Math.round(from[i] + (to[i] - from[i]) * t);
    }
    return out;
  }
  // 'oklab' — OKLab — RGB through OKLab; alpha linear.
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    const fLab = srgbU8ToOklab(from[k], from[k + 1], from[k + 2]);
    const tLab = srgbU8ToOklab(to[k], to[k + 1], to[k + 2]);
    const mid = lerpOklab(fLab, tLab, t);
    const [r, g, b] = oklabToSrgbU8(mid[0], mid[1], mid[2]);
    out[k] = r; out[k + 1] = g; out[k + 2] = b;
    out[k + 3] = Math.round(from[k + 3] + (to[k + 3] - from[k + 3]) * t);
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify round-trip passes**

Run: `npx vitest run src/animation/colorSpaces.test.ts`
Expected: PASS (round-trip test).

- [ ] **Step 5: Add midpoint and lerpColorArray tests**

Append to `src/animation/colorSpaces.test.ts`:

```ts
describe('lerpColorArray', () => {
  it('rgb midpoint between red and green is muddy gray', () => {
    const mid = lerpColorArray([255, 0, 0, 255], [0, 255, 0, 255], 0.5, 'rgb');
    expect(mid).toEqual([128, 128, 0, 255]);
  });

  it('oklab midpoint between red and green is NOT gray (luminance and chroma preserved)', () => {
    const mid = lerpColorArray([255, 0, 0, 255], [0, 255, 0, 255], 0.5, 'oklab');
    // Sanity: not equal to rgb gray midpoint.
    expect(mid[0]).not.toBe(128);
    // Should land in the yellow/orange family (R > B, G > B by a lot).
    expect(mid[0]).toBeGreaterThan(100);
    expect(mid[1]).toBeGreaterThan(100);
    expect(mid[2]).toBeLessThan(80);
  });

  it('throws on length mismatch', () => {
    expect(() => lerpColorArray([0, 0, 0, 255], [0, 0, 0, 255, 0, 0, 0, 255], 0.5)).toThrow();
  });

  it('throws on length not divisible by 4', () => {
    expect(() => lerpColorArray([0, 0, 0], [255, 255, 255], 0.5)).toThrow();
  });

  it('alpha lerps linearly even in oklab mode', () => {
    const mid = lerpColorArray([0, 0, 0, 0], [0, 0, 0, 200], 0.5, 'oklab');
    expect(mid[3]).toBe(100);
  });
});
```

- [ ] **Step 6: Run all colorSpaces tests**

Run: `npx vitest run src/animation/colorSpaces.test.ts`
Expected: PASS (all tests).

- [ ] **Step 7: Commit**

```bash
git add src/animation/colorSpaces.ts src/animation/colorSpaces.test.ts
git commit -m "feat(animation): sRGB ↔ OKLab math + lerpColorArray"
```

---

## Task 2: ColorOverrideRegistry

**Files:**
- Create: `src/animation/colorRegistry.ts`
- Test: `src/animation/colorRegistry.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/animation/colorRegistry.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { ColorOverrideRegistry } from './colorRegistry';

describe('ColorOverrideRegistry', () => {
  it('set + get round-trips an array override', () => {
    const r = new ColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(r.get('a', 'fill')).toEqual([1, 2, 3, 4]);
  });

  it('set + get round-trips a function override', () => {
    const r = new ColorOverrideRegistry();
    const fn = (base: readonly number[]) => base.slice();
    r.set('a', 'stroke', fn);
    expect(r.get('a', 'stroke')).toBe(fn);
  });

  it('clear removes one channel without affecting the other', () => {
    const r = new ColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    r.set('a', 'stroke', [5, 6, 7, 8]);
    r.clear('a', 'fill');
    expect(r.get('a', 'fill')).toBeUndefined();
    expect(r.get('a', 'stroke')).toEqual([5, 6, 7, 8]);
  });

  it('clearAll removes every override', () => {
    const r = new ColorOverrideRegistry();
    r.set('a', 'fill', [1, 2, 3, 4]);
    r.set('b', 'stroke', [5, 6, 7, 8]);
    r.clearAll();
    expect(r.get('a', 'fill')).toBeUndefined();
    expect(r.get('b', 'stroke')).toBeUndefined();
  });

  it('version increments on set and clear', () => {
    const r = new ColorOverrideRegistry();
    const v0 = r.version();
    r.set('a', 'fill', [1, 2, 3, 4]);
    expect(r.version()).toBeGreaterThan(v0);
    const v1 = r.version();
    r.clear('a', 'fill');
    expect(r.version()).toBeGreaterThan(v1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/colorRegistry.test.ts`
Expected: FAIL — `Cannot find module './colorRegistry'`.

- [ ] **Step 3: Implement ColorOverrideRegistry**

Create `src/animation/colorRegistry.ts`:

```ts
export type VertexColorChannel = 'fill' | 'stroke';

/** Function-form override: receives the consumer-supplied base color array
 *  and the current animation timestamp (ms, from the animator's clock).
 *  Returns a flat RGBA byte array of the same length as `base`. */
export type ColorOverrideFn = (base: readonly number[], tMs: number) => number[];

export type ColorOverride = readonly number[] | ColorOverrideFn;

interface NodeOverrides {
  fill?: ColorOverride;
  stroke?: ColorOverride;
}

/** Per-node, per-channel store of color overrides consulted by `createPathLayer`
 *  before falling back to the consumer's `getVertexColors` / `getStrokeVertexColors`
 *  accessor. Attached to `useAnimator` as `animator.colorOverrides`. */
export class ColorOverrideRegistry {
  private readonly map = new Map<string, NodeOverrides>();
  private _version = 0;

  set(id: string, channel: VertexColorChannel, override: ColorOverride): void {
    let entry = this.map.get(id);
    if (!entry) {
      entry = {};
      this.map.set(id, entry);
    }
    entry[channel] = override;
    this._version++;
  }

  clear(id: string, channel: VertexColorChannel): void {
    const entry = this.map.get(id);
    if (!entry) return;
    if (!(channel in entry)) return;
    delete entry[channel];
    if (!entry.fill && !entry.stroke) this.map.delete(id);
    this._version++;
  }

  clearAll(): void {
    if (this.map.size === 0) return;
    this.map.clear();
    this._version++;
  }

  get(id: string, channel: VertexColorChannel): ColorOverride | undefined {
    return this.map.get(id)?.[channel];
  }

  version(): number {
    return this._version;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/animation/colorRegistry.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/animation/colorRegistry.ts src/animation/colorRegistry.test.ts
git commit -m "feat(animation): ColorOverrideRegistry"
```

---

## Task 3: Attach registry to `useAnimator`

**Files:**
- Modify: `src/animation/types.ts` (add `colorOverrides` to `Animator`)
- Modify: `src/animation/useAnimator.ts` (instantiate + clear on unmount)
- Modify: `src/animation/useAnimator.test.tsx` (smoke test)

- [ ] **Step 1: Write failing test in `useAnimator.test.tsx`**

Append to `src/animation/useAnimator.test.tsx` (find a good location near other top-level animator tests):

```ts
describe('useAnimator.colorOverrides', () => {
  it('exposes a ColorOverrideRegistry instance', () => {
    const { result } = renderHook(() => useAnimator());
    expect(result.current.colorOverrides).toBeDefined();
    result.current.colorOverrides.set('x', 'fill', [1, 2, 3, 4]);
    expect(result.current.colorOverrides.get('x', 'fill')).toEqual([1, 2, 3, 4]);
  });

  it('clears overrides on unmount', () => {
    const { result, unmount } = renderHook(() => useAnimator());
    const registry = result.current.colorOverrides;
    registry.set('x', 'fill', [1, 2, 3, 4]);
    unmount();
    expect(registry.get('x', 'fill')).toBeUndefined();
  });
});
```

If the test file doesn't already import `renderHook` / `useAnimator`, copy the imports from the top of the file (they will already be present).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t "colorOverrides"`
Expected: FAIL — `colorOverrides` is `undefined` on the animator.

- [ ] **Step 3: Add field to `Animator` interface**

Edit `src/animation/types.ts`. Find the `Animator` interface (line ~132). Add the import and field:

At the top of the file (after existing exports), add:

```ts
import type { ColorOverrideRegistry } from './colorRegistry';
```

Inside `interface Animator { ... }`, add (after `stagger` overloads, just before the closing `}`):

```ts
  /** Per-node, per-channel color override registry consulted by the renderer's
   *  path layer before reading consumer accessors. Used by `tweenVertexColors`,
   *  `springVertexColors`, `cycleVertexColors`, `staggerVertexColors`. Cleared
   *  automatically on animator unmount. */
  colorOverrides: ColorOverrideRegistry;
```

- [ ] **Step 4: Instantiate registry in `useAnimator`**

Edit `src/animation/useAnimator.ts`.

Add import (alongside other imports at the top):

```ts
import { ColorOverrideRegistry } from './colorRegistry';
```

Inside `useAnimator` (after the existing `useRef` declarations near the top of the function body, before the `useMemo`), add:

```ts
const colorOverrides = useRef<ColorOverrideRegistry>(new ColorOverrideRegistry());
```

In the existing unmount-cleanup `useEffect` (search for `mountedRef.current = false`), add a `colorOverrides.current.clearAll()` call alongside the existing cleanup:

```ts
useEffect(() => {
  mountedRef.current = true;
  return () => {
    mountedRef.current = false;
    cleanupRef.current?.();
    colorOverrides.current.clearAll();
  };
}, []);
```

Inside the `useMemo<Animator>(() => { ... })` return value (find the returned object that holds `tween`, `spring`, etc.), add to the returned object:

```ts
colorOverrides: colorOverrides.current,
```

- [ ] **Step 5: Run tests to verify**

Run: `npx vitest run src/animation/useAnimator.test.tsx -t "colorOverrides"`
Expected: PASS.

Then run the full animator test suite to confirm no regression:

Run: `npx vitest run src/animation/`
Expected: PASS (all animation tests).

- [ ] **Step 6: Commit**

```bash
git add src/animation/types.ts src/animation/useAnimator.ts src/animation/useAnimator.test.tsx
git commit -m "feat(animation): attach ColorOverrideRegistry to useAnimator"
```

---

## Task 4: Wire registry into `createPathLayer`

**Files:**
- Modify: `src/features/paths/pathLayer.ts`
- Test: `src/features/paths/pathLayer.test.ts` (create if missing — check first)

- [ ] **Step 1: Check if pathLayer.test.ts exists**

Run: `ls src/features/paths/pathLayer.test.ts 2>/dev/null || echo "MISSING"`

If MISSING, create a fresh test file in step 2. Otherwise, append to existing.

- [ ] **Step 2: Write failing test for override consultation**

Create or append to `src/features/paths/pathLayer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createPathLayer } from './pathLayer';
import { polygonFromPoints } from './anchors';
import { ColorOverrideRegistry } from '../../animation/colorRegistry';
import type { DrawCommand } from '../../renderer';

interface PathNode { id: string }

function extractPathChildren(cmds: DrawCommand[]) {
  // pathLayer returns [{ kind: 'group', children: DrawCommand[] }]
  const group = cmds[0] as { kind: 'group'; children: DrawCommand[] };
  return group.children;
}

describe('createPathLayer color overrides', () => {
  const triangle = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]);
  const node: PathNode = { id: 'tri' };
  const baseFillColors = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255];

  it('falls back to the consumer accessor when no override is registered', () => {
    const layer = createPathLayer<PathNode>({
      getNodes: () => [node],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
    });
    const cmds = layer.draw({}, { x: 0, y: 0, zoom: 1 } as never);
    const children = extractPathChildren(cmds);
    expect((children[0] as { vertexColors: number[] }).vertexColors).toEqual(baseFillColors);
  });

  it('uses an array override when registered for fill', () => {
    const overrideColors = [128, 128, 128, 255, 128, 128, 128, 255, 128, 128, 128, 255];
    const registry = new ColorOverrideRegistry();
    registry.set('tri', 'fill', overrideColors);
    const layer = createPathLayer<PathNode>({
      getNodes: () => [node],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
      colorOverrides: registry,
    });
    const cmds = layer.draw({}, { x: 0, y: 0, zoom: 1 } as never);
    const children = extractPathChildren(cmds);
    expect((children[0] as { vertexColors: number[] }).vertexColors).toEqual(overrideColors);
  });

  it('calls a function override with base colors and tMs', () => {
    const registry = new ColorOverrideRegistry();
    let received: { base?: readonly number[]; tMs?: number } = {};
    registry.set('tri', 'fill', (base, tMs) => {
      received = { base, tMs };
      return base.map((v) => 255 - v);   // invert
    });
    const layer = createPathLayer<PathNode>({
      getNodes: () => [node],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
      colorOverrides: registry,
      now: () => 1234,
    });
    const cmds = layer.draw({}, { x: 0, y: 0, zoom: 1 } as never);
    const children = extractPathChildren(cmds);
    expect(received.base).toEqual(baseFillColors);
    expect(received.tMs).toBe(1234);
    expect((children[0] as { vertexColors: number[] }).vertexColors[0]).toBe(0);   // 255 → 0
  });

  it('falls back to base colors if function override returns wrong length (dev guard)', () => {
    const registry = new ColorOverrideRegistry();
    registry.set('tri', 'fill', () => [1, 2, 3, 4]);   // wrong length
    const layer = createPathLayer<PathNode>({
      getNodes: () => [node],
      getPath: () => triangle,
      getVertexColors: () => baseFillColors,
      colorOverrides: registry,
    });
    const cmds = layer.draw({}, { x: 0, y: 0, zoom: 1 } as never);
    const children = extractPathChildren(cmds);
    // Length validation should drop the override; base wins.
    expect((children[0] as { vertexColors: number[] }).vertexColors).toEqual(baseFillColors);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/paths/pathLayer.test.ts -t "color overrides"`
Expected: FAIL (`colorOverrides` not a valid option, behavior incorrect).

- [ ] **Step 4: Add `colorOverrides` + `now` options to `createPathLayer`**

Edit `src/features/paths/pathLayer.ts`.

Add import at the top:

```ts
import type { ColorOverrideRegistry } from '../../animation/colorRegistry';
```

Extend `CreatePathLayerOpts<T>` (after `getStrokeVertexWidths` declaration, around line 51):

```ts
  /**
   * Optional color override registry, typically `animator.colorOverrides`.
   * When set, the renderer consults it before falling back to
   * `getVertexColors` / `getStrokeVertexColors`. Function-form overrides
   * receive the base color array and the current animation timestamp.
   */
  colorOverrides?: ColorOverrideRegistry;
  /**
   * Clock used to timestamp function-form color overrides. Defaults to
   * `performance.now`. Override in tests.
   */
  now?: () => number;
```

Modify the destructure (around line 56–60):

```ts
  const {
    id = 'paths', label = 'Paths',
    getNodes, getPath, getFill, getStroke, isHidden,
    getVertexColors, getStrokeVertexColors, getStrokeVertexWidths,
    colorOverrides,
    now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  } = opts;
```

In the `draw` function body, replace the `vColors` / `strokeVColors` retrieval lines (currently lines 78–79):

```ts
        const baseVColors = getVertexColors?.(node);
        const baseStrokeVColors = getStrokeVertexColors?.(node);

        const nodeId = (node as { id?: string }).id ?? String(idx);
        const tMs = colorOverrides ? now() : 0;

        const fillOverride = colorOverrides?.get(nodeId, 'fill');
        const strokeOverride = colorOverrides?.get(nodeId, 'stroke');

        const vColors = resolveOverride(baseVColors, fillOverride, tMs);
        const strokeVColors = resolveOverride(baseStrokeVColors, strokeOverride, tMs);
```

Replace the existing `const nodeKey = ...` line (currently line 82) so it reuses `nodeId`:

```ts
        const nodeKey = nodeId;
        const anchorCount = countPathAnchors(path);
        const expectedLen = 4 * anchorCount;
```

Add this helper near the top of the module (after the `PLACEHOLDER_STROKE` constant):

```ts
function resolveOverride(
  base: readonly number[] | null | undefined,
  override: ColorOverride | undefined,
  tMs: number,
): readonly number[] | null | undefined {
  if (!override) return base;
  if (typeof override === 'function') {
    if (!base) return base;
    const result = override(base, tMs);
    // Defensive: if the function returns a mismatched length, fall back to base.
    if (result.length !== base.length) return base;
    return result;
  }
  return override;
}
```

Add the type import alongside the registry import:

```ts
import type { ColorOverride, ColorOverrideRegistry } from '../../animation/colorRegistry';
```

Note: existing `vColors`/`strokeVColors` were typed as `number[] | null | undefined`. After this change they are `readonly number[] | null | undefined`. The downstream `useVColors`/`useStrokeVColors` assignment chain (lines 86–116) uses `.length` and stores the value in a `number[]` slot pushed into the `DrawCommand`. Update those typings: change `let useVColors: number[] | null = null;` to `let useVColors: readonly number[] | null = null;` and the same for `useStrokeVColors`. Also update the spread into the `Stroke` object at line 149 and the `DrawCommand` push at line 161 to accept the readonly type — `DrawCommand.vertexColors` is `number[]`, so a cast `as number[]` is acceptable at those two write sites (they are by-reference reads downstream, not mutations).

- [ ] **Step 5: Run pathLayer tests to verify**

Run: `npx vitest run src/features/paths/pathLayer.test.ts`
Expected: PASS (all tests).

- [ ] **Step 6: Run the broader paths test suite to catch regressions**

Run: `npx vitest run src/features/paths/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/paths/pathLayer.ts src/features/paths/pathLayer.test.ts
git commit -m "feat(paths): createPathLayer consults ColorOverrideRegistry"
```

---

## Task 5: `tweenVertexColors` helper

**Files:**
- Create: `src/animation/colorHelpers.ts`
- Test: `src/animation/colorHelpers.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/animation/colorHelpers.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAnimator } from './useAnimator';
import { tweenVertexColors } from './colorHelpers';

function makeClock() {
  let now = 0;
  const cbs = new Map<number, (t: number) => void>();
  let h = 1;
  return {
    now: () => now,
    requestFrame: (cb: (t: number) => void) => { const id = h++; cbs.set(id, cb); return id; },
    cancelFrame: (id: number) => cbs.delete(id),
    advance: (dt: number) => {
      now += dt;
      const due = Array.from(cbs.values());
      cbs.clear();
      for (const cb of due) cb(now);
    },
  };
}

describe('tweenVertexColors', () => {
  it('writes interpolated colors to the registry each tick (rgb space)', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const from = [255, 0, 0, 255];
    const to = [0, 255, 0, 255];
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from,
        to,
        ms: 100,
        easing: (t) => t,   // linear
      });
    });
    act(() => clock.advance(0));   // kick off
    // Halfway through
    act(() => clock.advance(50));
    const mid = result.current.colorOverrides.get('a', 'fill') as number[];
    expect(mid).toEqual([128, 128, 0, 255]);   // rgb midpoint
  });

  it('clears the override and fires onDone when complete', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'stroke',
        from: [0, 0, 0, 255],
        to: [255, 255, 255, 255],
        ms: 100,
        onDone,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(100));
    expect(onDone).toHaveBeenCalledOnce();
    expect(result.current.colorOverrides.get('a', 'stroke')).toBeUndefined();
  });

  it('throws on from/to length mismatch', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [0, 0, 0, 255, 0, 0, 0, 255],
        ms: 100,
      });
    }).toThrow();
  });

  it('uses oklab space when requested (red→green midpoint is not gray)', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [255, 0, 0, 255],
        to: [0, 255, 0, 255],
        ms: 100,
        easing: (t) => t,
        interpolation: 'oklab',
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    const mid = result.current.colorOverrides.get('a', 'fill') as number[];
    // Not the rgb gray midpoint.
    expect(mid).not.toEqual([128, 128, 0, 255]);
  });

  it('uses custom interpolate when provided (overrides interpolation option)', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const custom = vi.fn((_a: readonly number[], _b: readonly number[], _t: number) =>
      [42, 42, 42, 42],
    );
    act(() => {
      tweenVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 0],
        to: [255, 255, 255, 255],
        ms: 100,
        interpolation: 'oklab',   // should be ignored
        interpolate: custom,
      });
    });
    act(() => clock.advance(0));
    act(() => clock.advance(50));
    expect(custom).toHaveBeenCalled();
    expect(result.current.colorOverrides.get('a', 'fill')).toEqual([42, 42, 42, 42]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/animation/colorHelpers.test.ts`
Expected: FAIL — `Cannot find module './colorHelpers'`.

- [ ] **Step 3: Implement `tweenVertexColors`**

Create `src/animation/colorHelpers.ts`:

```ts
import type {
  AnimationHandle,
  Animator,
  EasingFn,
  SpringPresetName,
} from './types';
import type { VertexColorChannel } from './colorRegistry';
import { lerpColorArray, type ColorSpace } from './colorSpaces';

export type ColorInterpolate = (
  from: readonly number[],
  to: readonly number[],
  t: number,
) => number[];

export interface TweenVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  to: readonly number[];
  from: readonly number[];
  ms: number;
  easing?: EasingFn;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

function validateLengths(from: readonly number[], to: readonly number[]): void {
  if (from.length !== to.length) {
    throw new Error(
      `vertex colors: length mismatch (from=${from.length}, to=${to.length})`,
    );
  }
  if (from.length === 0 || from.length % 4 !== 0) {
    throw new Error(
      `vertex colors: length ${from.length} must be a positive multiple of 4`,
    );
  }
}

function resolveInterpolator(
  opts: { interpolation?: ColorSpace; interpolate?: ColorInterpolate },
): ColorInterpolate {
  if (opts.interpolate) return opts.interpolate;
  const space: ColorSpace = opts.interpolation ?? 'rgb';
  return (a, b, t) => lerpColorArray(a, b, t, space);
}

const cancelKeyFor = (id: string, channel: VertexColorChannel): string =>
  `colors:${id}:${channel}`;

export function tweenVertexColors(
  animator: Animator,
  opts: TweenVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { id, channel } = opts;
  return animator.tween<number>({
    from: 0,
    to: 1,
    ms: opts.ms,
    easing: opts.easing,
    cancelKey: cancelKeyFor(id, channel),
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: (t) => {
      animator.colorOverrides.set(id, channel, interp(opts.from, opts.to, t));
    },
    onDone: () => {
      animator.colorOverrides.clear(id, channel);
      opts.onDone?.();
    },
  });
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run src/animation/colorHelpers.test.ts`
Expected: PASS (all `tweenVertexColors` tests).

- [ ] **Step 5: Commit**

```bash
git add src/animation/colorHelpers.ts src/animation/colorHelpers.test.ts
git commit -m "feat(animation): tweenVertexColors helper"
```

---

## Task 6: `springVertexColors` helper

**Files:**
- Modify: `src/animation/colorHelpers.ts`
- Modify: `src/animation/colorHelpers.test.ts`

- [ ] **Step 1: Add failing test**

Append to `src/animation/colorHelpers.test.ts` (inside the same file, new `describe` block):

```ts
import { springVertexColors } from './colorHelpers';

describe('springVertexColors', () => {
  it('settles at the target color and clears the override', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      springVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [255, 128, 64, 255],
        preset: 'stiff',
        onDone,
      });
    });
    // Spring should settle within ~2 seconds at 'stiff' preset; advance generously.
    act(() => clock.advance(0));
    for (let i = 0; i < 200; i++) {
      act(() => clock.advance(16));
      if (onDone.mock.calls.length > 0) break;
    }
    expect(onDone).toHaveBeenCalled();
    expect(result.current.colorOverrides.get('a', 'fill')).toBeUndefined();
  });

  it('throws on length mismatch', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() => {
      springVertexColors(result.current, {
        id: 'a',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [0, 0, 0, 255, 0, 0, 0, 255],
      });
    }).toThrow();
  });
});
```

Also add this import at the top of the helper file in the import list (just adding `springVertexColors` — the `tweenVertexColors` import already exists):

```ts
import { tweenVertexColors, springVertexColors } from './colorHelpers';
```

(Replace the existing `tweenVertexColors`-only import line.)

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/animation/colorHelpers.test.ts -t "springVertexColors"`
Expected: FAIL — `springVertexColors` not exported.

- [ ] **Step 3: Implement `springVertexColors`**

Append to `src/animation/colorHelpers.ts`:

```ts
export interface SpringVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  to: readonly number[];
  from: readonly number[];
  preset?: SpringPresetName;
  stiffness?: number;
  damping?: number;
  mass?: number;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

export function springVertexColors(
  animator: Animator,
  opts: SpringVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { id, channel } = opts;
  // Integrate a 0→1 progress scalar (mirrors springPose pattern); lerp the
  // color array on each tick.
  return animator.spring<number>({
    from: 0,
    to: 1,
    preset: opts.preset,
    stiffness: opts.stiffness,
    damping: opts.damping,
    mass: opts.mass,
    cancelKey: cancelKeyFor(id, channel),
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: (t) => {
      // Clamp; spring overshoot beyond 1 would amplify the to-from delta.
      const clamped = Math.max(0, Math.min(1, t));
      animator.colorOverrides.set(id, channel, interp(opts.from, opts.to, clamped));
    },
    onDone: () => {
      animator.colorOverrides.clear(id, channel);
      opts.onDone?.();
    },
  });
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run src/animation/colorHelpers.test.ts`
Expected: PASS (all tween + spring tests).

- [ ] **Step 5: Commit**

```bash
git add src/animation/colorHelpers.ts src/animation/colorHelpers.test.ts
git commit -m "feat(animation): springVertexColors helper"
```

---

## Task 7: `cycleVertexColors` helper

**Files:**
- Modify: `src/animation/colorHelpers.ts`
- Modify: `src/animation/colorHelpers.test.ts`

- [ ] **Step 1: Add failing test**

Append to `src/animation/colorHelpers.test.ts`:

```ts
import { cycleVertexColors } from './colorHelpers';

describe('cycleVertexColors', () => {
  it('registers a function override that rotates colors along the path', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const base = [
      255, 0, 0, 255,    // anchor 0 — red
      0, 255, 0, 255,    // anchor 1 — green
      0, 0, 255, 255,    // anchor 2 — blue
    ];
    act(() => {
      cycleVertexColors(result.current, {
        id: 'tri',
        channel: 'stroke',
        msPerCycle: 300,   // 3 anchors / 300ms = 1 step per 100ms
      });
    });
    const override = result.current.colorOverrides.get('tri', 'stroke');
    expect(typeof override).toBe('function');

    // At t=0, no rotation.
    const fn = override as (base: readonly number[], tMs: number) => number[];
    expect(fn(base, 0)).toEqual(base);

    // At t=100ms, phase=1, exactly one step rotation: anchor 0 now reads anchor 1, etc.
    const t100 = fn(base, 100);
    expect(t100.slice(0, 4)).toEqual([0, 255, 0, 255]);   // was red, now green
    expect(t100.slice(4, 8)).toEqual([0, 0, 255, 255]);    // was green, now blue
    expect(t100.slice(8, 12)).toEqual([255, 0, 0, 255]);   // was blue, now red (wrap)
  });

  it('cancel() removes the override', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    let handle: { cancel: () => void } | undefined;
    act(() => {
      handle = cycleVertexColors(result.current, {
        id: 'tri',
        channel: 'fill',
        msPerCycle: 1000,
      });
    });
    expect(result.current.colorOverrides.get('tri', 'fill')).toBeDefined();
    act(() => { handle!.cancel(); });
    expect(result.current.colorOverrides.get('tri', 'fill')).toBeUndefined();
  });

  it('direction: -1 rotates the other way', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const base = [255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255];
    act(() => {
      cycleVertexColors(result.current, {
        id: 'tri',
        channel: 'stroke',
        msPerCycle: 300,
        direction: -1,
      });
    });
    const fn = result.current.colorOverrides.get('tri', 'stroke') as
      (base: readonly number[], tMs: number) => number[];
    const t100 = fn(base, 100);
    // direction=-1, phase=-1: anchor 0 reads anchor 2 (-1 mod 3 = 2).
    expect(t100.slice(0, 4)).toEqual([0, 0, 255, 255]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/animation/colorHelpers.test.ts -t "cycleVertexColors"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement `cycleVertexColors`**

Append to `src/animation/colorHelpers.ts`:

```ts
export interface CycleVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  msPerCycle: number;
  direction?: 1 | -1;
  easing?: EasingFn;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
}

export interface CycleHandle {
  cancel(): void;
}

/** Register a function override that phase-rotates the base color array
 *  along the path index. Returns a handle whose `cancel()` removes the
 *  override.
 *
 *  No animator.loop is needed — the renderer calls the function override
 *  on every draw with the current timestamp, and the function derives the
 *  phase from `tMs` directly. Cycles do not appear in `animator.isActive()`
 *  by design (they are passive renderer-driven overrides, not scheduled
 *  animations). If a consumer needs scheduling parity (pause/resume via
 *  animator.pauseKey), wrap the cancel handle yourself. */
export function cycleVertexColors(
  animator: Animator,
  opts: CycleVertexColorsOptions,
): CycleHandle {
  const interp = resolveInterpolator(opts);
  const { id, channel } = opts;
  const direction = opts.direction ?? 1;
  const easing = opts.easing ?? ((t: number) => t);

  const override = (base: readonly number[], tMs: number): number[] => {
    const n = base.length / 4;
    if (n === 0) return base.slice();
    // Continuous phase in anchor-index units. msPerCycle = time to advance n steps.
    const raw = (tMs / opts.msPerCycle) * n * direction;
    // Apply easing per-cycle to the fractional part of the cycle.
    const cycles = raw / n;
    const cycleFrac = cycles - Math.floor(cycles);
    const easedFrac = easing(cycleFrac);
    const easedRaw = (Math.floor(cycles) + easedFrac) * n;
    // Normalize to [0, n).
    const phase = ((easedRaw % n) + n) % n;
    const phaseInt = Math.floor(phase);
    const phaseFrac = phase - phaseInt;

    const out = new Array<number>(base.length);
    for (let i = 0; i < n; i++) {
      const aIdx = ((i + phaseInt) % n) * 4;
      const bIdx = ((i + phaseInt + 1) % n) * 4;
      const a = [base[aIdx], base[aIdx + 1], base[aIdx + 2], base[aIdx + 3]];
      const b = [base[bIdx], base[bIdx + 1], base[bIdx + 2], base[bIdx + 3]];
      const blended = interp(a, b, phaseFrac);
      const k = i * 4;
      out[k] = blended[0]; out[k + 1] = blended[1];
      out[k + 2] = blended[2]; out[k + 3] = blended[3];
    }
    return out;
  };

  animator.colorOverrides.set(id, channel, override);

  return {
    cancel(): void {
      animator.colorOverrides.clear(id, channel);
    },
  };
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run src/animation/colorHelpers.test.ts`
Expected: PASS (all tests).

- [ ] **Step 5: Commit**

```bash
git add src/animation/colorHelpers.ts src/animation/colorHelpers.test.ts
git commit -m "feat(animation): cycleVertexColors helper"
```

---

## Task 8: `staggerVertexColors` helper

**Files:**
- Modify: `src/animation/colorHelpers.ts`
- Modify: `src/animation/colorHelpers.test.ts`

- [ ] **Step 1: Add failing test**

Append to `src/animation/colorHelpers.test.ts`:

```ts
import { staggerVertexColors } from './colorHelpers';

describe('staggerVertexColors', () => {
  it('transitions anchors from origin outward', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const from = [
      0, 0, 0, 255,
      0, 0, 0, 255,
      0, 0, 0, 255,
    ];
    const to = [
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 255,
    ];
    act(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'stroke',
        from,
        to,
        anchorMs: 100,
        perAnchorDelay: 50,
        origin: 'first',
        easing: (t) => t,
      });
    });

    const fn = result.current.colorOverrides.get('p', 'stroke') as
      (base: readonly number[], tMs: number) => number[];

    // At t=0: nothing has started.
    expect(fn(from, 0)).toEqual(from);

    // At t=50ms: anchor 0 is half done, anchor 1 just starting, anchor 2 still off.
    const at50 = fn(from, 50);
    expect(at50.slice(0, 4)).toEqual([128, 128, 128, 255]);   // anchor 0 t=0.5
    expect(at50.slice(4, 8)).toEqual([0, 0, 0, 255]);          // anchor 1 t=0
    expect(at50.slice(8, 12)).toEqual([0, 0, 0, 255]);         // anchor 2 not started

    // At t=300ms: all three should be fully at `to`.
    const at300 = fn(from, 300);
    expect(at300).toEqual(to);
  });

  it('fires onDone after the slowest anchor completes and clears the override', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const onDone = vi.fn();
    act(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'fill',
        from: [0, 0, 0, 255, 0, 0, 0, 255],
        to: [255, 255, 255, 255, 255, 255, 255, 255],
        anchorMs: 100,
        perAnchorDelay: 50,
        onDone,
      });
    });
    // Pulse the renderer-side function override by advancing time and reading.
    // For onDone to fire, the helper must use animator.stagger internally.
    act(() => clock.advance(0));
    act(() => clock.advance(200));   // last anchor: start@50, end@150
    expect(onDone).toHaveBeenCalled();
    expect(result.current.colorOverrides.get('p', 'fill')).toBeUndefined();
  });

  it('origin: "last" reverses the propagation', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    const from = [0, 0, 0, 255, 0, 0, 0, 255, 0, 0, 0, 255];
    const to = [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255];
    act(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'stroke',
        from,
        to,
        anchorMs: 100,
        perAnchorDelay: 50,
        origin: 'last',
        easing: (t) => t,
      });
    });
    const fn = result.current.colorOverrides.get('p', 'stroke') as
      (base: readonly number[], tMs: number) => number[];
    const at50 = fn(from, 50);
    expect(at50.slice(8, 12)).toEqual([128, 128, 128, 255]);   // anchor 2 (origin) t=0.5
    expect(at50.slice(0, 4)).toEqual([0, 0, 0, 255]);           // anchor 0 (farthest) not started
  });

  it('throws on length mismatch', () => {
    const clock = makeClock();
    const { result } = renderHook(() => useAnimator(clock));
    expect(() => {
      staggerVertexColors(result.current, {
        id: 'p',
        channel: 'fill',
        from: [0, 0, 0, 255],
        to: [0, 0, 0, 255, 0, 0, 0, 255],
        anchorMs: 100,
        perAnchorDelay: 50,
      });
    }).toThrow();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run src/animation/colorHelpers.test.ts -t "staggerVertexColors"`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement `staggerVertexColors`**

Append to `src/animation/colorHelpers.ts`:

```ts
export interface StaggerVertexColorsOptions {
  id: string;
  channel: VertexColorChannel;
  to: readonly number[];
  from: readonly number[];
  anchorMs: number;
  perAnchorDelay: number;
  origin?: 'first' | 'last' | number;
  easing?: EasingFn;
  interpolation?: ColorSpace;
  interpolate?: ColorInterpolate;
  onDone?: () => void;
}

export function staggerVertexColors(
  animator: Animator,
  opts: StaggerVertexColorsOptions,
): AnimationHandle {
  validateLengths(opts.from, opts.to);
  const interp = resolveInterpolator(opts);
  const { id, channel, from, to, anchorMs, perAnchorDelay } = opts;
  const n = from.length / 4;
  const easing = opts.easing ?? ((t: number) => t);

  const originIndex =
    opts.origin === 'last' ? n - 1 :
    typeof opts.origin === 'number' ? Math.max(0, Math.min(n - 1, opts.origin)) :
    0;

  // Total runtime = (farthest anchor's delay) + anchorMs.
  const maxDistance = Math.max(originIndex, n - 1 - originIndex);
  const totalMs = maxDistance * perAnchorDelay + anchorMs;

  // Function override: derives per-anchor local-t from tMs each draw.
  const override = (base: readonly number[], tMs: number): number[] => {
    const out = new Array<number>(from.length);
    for (let i = 0; i < n; i++) {
      const distance = Math.abs(i - originIndex);
      const startMs = distance * perAnchorDelay;
      const localT = Math.max(0, Math.min(1, (tMs - startMs) / anchorMs));
      const eased = easing(localT);
      const k = i * 4;
      const fSlice = [from[k], from[k + 1], from[k + 2], from[k + 3]];
      const tSlice = [to[k], to[k + 1], to[k + 2], to[k + 3]];
      const blended = interp(fSlice, tSlice, eased);
      out[k] = blended[0]; out[k + 1] = blended[1];
      out[k + 2] = blended[2]; out[k + 3] = blended[3];
    }
    return out;
  };

  animator.colorOverrides.set(id, channel, override);

  // Drive a single tween whose only purpose is to fire onDone and clear
  // the override when totalMs has elapsed. The override itself is the
  // function above; the tween's onTick is a no-op.
  return animator.tween<number>({
    from: 0,
    to: 1,
    ms: totalMs,
    easing: (t) => t,
    cancelKey: cancelKeyFor(id, channel),
    interpolate: (a, b, t) => a + (b - a) * t,
    onTick: () => {},
    onDone: () => {
      animator.colorOverrides.clear(id, channel);
      opts.onDone?.();
    },
  });
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npx vitest run src/animation/colorHelpers.test.ts`
Expected: PASS (all four helpers' tests).

- [ ] **Step 5: Commit**

```bash
git add src/animation/colorHelpers.ts src/animation/colorHelpers.test.ts
git commit -m "feat(animation): staggerVertexColors helper"
```

---

## Task 9: Re-export from `src/animation/index.ts`

**Files:**
- Modify: `src/animation/index.ts`

- [ ] **Step 1: Add exports**

Read the current `src/animation/index.ts`. Below the existing `momentum` export, add:

```ts
export {
  ColorOverrideRegistry,
  type ColorOverride, type ColorOverrideFn, type VertexColorChannel,
} from './colorRegistry';
export {
  srgbU8ToOklab, oklabToSrgbU8, lerpOklab, lerpColorArray,
  type ColorSpace,
} from './colorSpaces';
export {
  tweenVertexColors, springVertexColors, cycleVertexColors, staggerVertexColors,
  type TweenVertexColorsOptions, type SpringVertexColorsOptions,
  type CycleVertexColorsOptions, type StaggerVertexColorsOptions,
  type CycleHandle, type ColorInterpolate,
} from './colorHelpers';
```

- [ ] **Step 2: Verify the root barrel picks up new exports**

Run: `grep -n "from './animation'" src/index.ts`
Expected: matches `export * from './animation'` — new exports propagate automatically.

- [ ] **Step 3: Run typecheck to confirm no broken types**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 4: Run the full test suite**

Run: `npx vitest run`
Expected: PASS (all tests, including new ones).

- [ ] **Step 5: Commit**

```bash
git add src/animation/index.ts
git commit -m "feat(animation): re-export color-animation API"
```

---

## Task 10: Demo in `BezierEditDemo`

**Files:**
- Modify: `demo/demos/BezierEditDemo.tsx`

- [ ] **Step 1: Read the existing demo**

Read `demo/demos/BezierEditDemo.tsx` to understand:
- How the rainbow stroke colors are currently computed.
- Whether the demo already uses `useAnimator` (if not, you'll need to add the hook).
- Where the path's `id` lives.

This is exploratory — make notes mentally, don't change anything yet.

- [ ] **Step 2: Add `useAnimator` and pass `colorOverrides` to the path layer**

Locate where the path layer is constructed in the demo (search for `createPathLayer`). Add:

```tsx
const animator = useAnimator();
```

at the top of the demo component, and pass `colorOverrides: animator.colorOverrides` into the `createPathLayer` call's options bag.

- [ ] **Step 3: Add three demo controls (tween / cycle / stagger)**

Just below the existing canvas/UI surface in the demo (in JSX), add a small control panel:

```tsx
<div className="bezier-edit-demo-controls">
  <button
    type="button"
    onClick={() => {
      const fromColors = currentRainbowColors;   // the demo's existing stroke color array
      const redAll = Array.from({ length: fromColors.length / 4 }, () => [255, 0, 0, 255]).flat();
      tweenVertexColors(animator, {
        id: pathNodeId,
        channel: 'stroke',
        from: fromColors,
        to: redAll,
        ms: 800,
      });
    }}
  >
    Tween → solid red
  </button>

  <label>
    <input
      type="checkbox"
      onChange={(e) => {
        if (e.currentTarget.checked) {
          cycleHandleRef.current = cycleVertexColors(animator, {
            id: pathNodeId,
            channel: 'stroke',
            msPerCycle: 1500,
            interpolation: cycleOklab ? 'oklab' : 'rgb',
          });
        } else {
          cycleHandleRef.current?.cancel();
          cycleHandleRef.current = null;
        }
      }}
    />
    Cycle
  </label>

  <label>
    <input
      type="checkbox"
      checked={cycleOklab}
      onChange={(e) => setCycleOklch(e.currentTarget.checked)}
    />
    OKLCH (in cycle)
  </label>

  <button
    type="button"
    onClick={() => {
      const fromColors = currentRainbowColors;
      const toAll = Array.from({ length: fromColors.length / 4 }, () => [255, 255, 255, 255]).flat();
      staggerVertexColors(animator, {
        id: pathNodeId,
        channel: 'stroke',
        from: fromColors,
        to: toAll,
        anchorMs: 400,
        perAnchorDelay: 200,
        origin: 'first',
      });
    }}
  >
    Stagger → white from first anchor
  </button>
</div>
```

Notes for the implementer:
- `currentRainbowColors` is a placeholder — substitute whatever expression in the demo currently produces the rainbow stroke color array.
- `pathNodeId` is a placeholder — substitute the actual node id used in the demo.
- Add the state and ref needed: `const [cycleOklab, setCycleOklch] = useState(false);` and `const cycleHandleRef = useRef<CycleHandle | null>(null);`
- Imports at the top of the file should include:
  ```tsx
  import {
    useAnimator,
    tweenVertexColors,
    cycleVertexColors,
    staggerVertexColors,
    type CycleHandle,
  } from '@orochi235/weasel';
  ```

- [ ] **Step 4: Verify the demo loads in the dev server**

Run: `npm run dev` (or whatever the demo dev command is — check `package.json` scripts).
Navigate to the `BezierEditDemo` in the browser.

Expected:
- Tween button morphs the rainbow stroke to solid red over 800ms; the original rainbow returns when the tween completes (because the override clears).
- Cycle toggle rotates the rainbow colors along the path continuously; toggling OKLCH shows visibly smoother color transitions between adjacent anchors.
- Stagger button ripples the stroke to white from the first anchor outward.

If any control does not behave as described, debug before proceeding.

- [ ] **Step 5: Add minimal CSS for the control panel (optional)**

If the controls look ugly, add a small CSS block in the demo's existing stylesheet (look for `BezierEditDemo.css` or similar). Keep it simple — this is a demo, not a polished UI.

Per CLAUDE.md: no inline styles, no `!important`. Use CSS classes.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/BezierEditDemo.tsx demo/demos/*.css
git commit -m "demo(bezier-edit): tween / cycle / stagger vertex-color animation"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run `prepublishOnly` gate (per memory: matches CI's release gate)**

Run: `npm run prepublishOnly` (or `npx tsc --noEmit && npx vitest run && npx tsup`)
Expected: typecheck passes, all tests pass, build succeeds.

- [ ] **Step 2: Update `docs/TODO.md`**

Find the open follow-up note on per-anchor coloring (search for "animation primitive integration" or "color cycling along a stroke"). Strike it out as shipped — match the file's existing convention for noting completed items. If the TODO line is in the priority index too, update accordingly.

- [ ] **Step 3: Commit TODO update**

```bash
git add docs/TODO.md
git commit -m "docs(todo): mark per-anchor color animation as shipped"
```

- [ ] **Step 4: Report back to user**

Summarize the branch state: branch name, commit count, test count, demo verification status. Ask whether to merge to `main` (per memory: never push without explicit confirmation).
