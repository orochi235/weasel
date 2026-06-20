# Geometry Kernel Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `@weasel-js/geom` package — a pure, dependency-walled 2D geometry kernel (scalar/Mat3/box/curve/polyline/affine) plus a `booleans` subpath — with property tests, as the additive foundation for the geometry consolidation.

**Architecture:** A new source-exported workspace at `packages/geom`, resolved automatically by `weaselAliases` and run under the existing `weasel-ui` vitest project. Pure core has `deps: {}`; the `booleans` subpath isolates the `polygon-clipping` dependency. Code is overwhelmingly *ported* from existing `src/features/paths/*` implementations, rewritten to the flat-everywhere / f64-compute representation. **This plan is purely additive** — it does not modify or re-point any existing kit code (that is Spec 2), except adding two `tsconfig.json` paths entries.

**Tech Stack:** TypeScript (source-exported workspace), Vitest, `polygon-clipping` (booleans subpath only).

**Spec:** `docs/superpowers/specs/2026-06-20-geometry-kernel-representation-design.md`
**Companion analysis:** `docs/superpowers/specs/2026-06-20-geometry-consolidation-analysis.md`

**Out of scope (Spec 2):** re-pointing the seven seams, deleting the duplicate `pointInPolygon`/`segmentsCross`/`unionBounds`/`cubicEval`, moving the `PATH_*` constants out of `features/paths` (here geom gets its *own* canonical copy; convergence is Spec 2), the resize-after-boolean fix, and the kit-level + apps/draw `geometryContract.test.ts` (it lands in Spec 2 where it goes red→green alongside the fix).

**Representation conventions (apply to every task):**
- Coordinate streams are flat interleaved `[x0,y0,x1,y1,…]`. Inputs accept `ArrayLike<number>` (so `Float32Array` from a `Path` or a plain array both work); computed outputs are `Float64Array`. No `{x,y}` / `Vec2` / `[x,y][]` anywhere in the core.
- Single points: inputs are scalar pairs (`fn(px, py, …)`); returns are `[x, y]` tuples (cold paths) or out-params (hot paths).
- All arithmetic is f64 (JS-native); never narrow to `Float32Array` inside the kernel.
- Epsilon comparisons use the `scalar.ts` magnitude-scaled policy — never a bare `===` on computed floats, never an f64-tight literal.

---

### Task 1: Scaffold the `@weasel-js/geom` package

**Files:**
- Create: `packages/geom/package.json`
- Create: `packages/geom/tsconfig.json`
- Create: `packages/geom/src/index.ts`
- Create: `packages/geom/src/scaffold.test.ts`
- Modify: `tsconfig.json` (root) — add `paths` entries

- [ ] **Step 1: Create the package manifest**

`packages/geom/package.json` (mirrors `packages/svg/package.json`, adds the `./booleans` subpath export and the clipper dep scoped to it):

```json
{
  "name": "@weasel-js/geom",
  "version": "0.0.0",
  "private": true,
  "description": "Pure 2D geometry kernel for @weasel-js/core: affine, box, curve, polyline. Dependency-free core; polygon booleans in the ./booleans subpath.",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "main": "./src/index.ts",
  "module": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./booleans": {
      "import": "./src/booleans/index.ts",
      "types": "./src/booleans/index.ts"
    },
    "./package.json": "./package.json"
  },
  "dependencies": {
    "polygon-clipping": "^0.15.7"
  },
  "scripts": {
    "test": "vitest run"
  }
}
```

- [ ] **Step 2: Create the package tsconfig** (identical to `packages/svg/tsconfig.json`)

`packages/geom/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "include": ["src"],
  "compilerOptions": {
    "rootDir": "src",
    "noEmit": true
  }
}
```

- [ ] **Step 3: Add root tsconfig paths** so `tsc --noEmit` (the `typecheck`/`lint` script) and editors resolve the package. In `tsconfig.json`, inside `compilerOptions.paths`, after the `@weasel-js/svg` line (currently line 32), add:

```jsonc
      "@weasel-js/geom": ["./packages/geom/src/index.ts"],
      "@weasel-js/geom/booleans": ["./packages/geom/src/booleans/index.ts"],
      "@weasel-js/geom/*": ["./packages/geom/src/*"],
```

(`weaselAliases` already covers vite/vitest resolution from the dir name — no vitest/alias-map edit needed. Core's `tsup` build is untouched because nothing in `src/` imports geom yet.)

- [ ] **Step 4: Create a placeholder barrel and a smoke test**

`packages/geom/src/index.ts`:

```ts
/** @weasel-js/geom — pure 2D geometry kernel. Barrel re-exports per tier. */
export const GEOM_PACKAGE = '@weasel-js/geom';
```

`packages/geom/src/scaffold.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { GEOM_PACKAGE } from '@weasel-js/geom';

describe('@weasel-js/geom scaffold', () => {
  it('resolves the package entry', () => {
    expect(GEOM_PACKAGE).toBe('@weasel-js/geom');
  });
});
```

- [ ] **Step 5: Install workspace deps and run the smoke test**

Run: `npm install` then `npm run test:ui -- packages/geom`
Expected: PASS (the `weasel-ui` project picks up `packages/geom/src/**/*.test.ts`). `npm install` links the new workspace and `polygon-clipping` into `packages/geom/node_modules`.

- [ ] **Step 6: Verify typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors from the new paths entries).

- [ ] **Step 7: Commit**

```bash
git add packages/geom tsconfig.json package-lock.json
git commit -m "feat(geom): scaffold @weasel-js/geom package + booleans subpath"
```

---

### Task 2: Scalar/vector primitives + epsilon policy

**Files:**
- Create: `packages/geom/src/scalar.ts`
- Test: `packages/geom/src/scalar.test.ts`

- [ ] **Step 1: Write the failing test**

`packages/geom/src/scalar.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cross, dot, sub, len2, sign, approxEq, EPS } from './scalar';

describe('scalar primitives', () => {
  it('cross product is the 2D wedge', () => {
    expect(cross(1, 0, 0, 1)).toBe(1);
    expect(cross(0, 1, 1, 0)).toBe(-1);
  });
  it('dot and len2', () => {
    expect(dot(1, 2, 3, 4)).toBe(11);
    expect(len2(3, 4)).toBe(25);
  });
  it('sub returns the component delta as a tuple', () => {
    expect(sub(5, 7, 2, 3)).toEqual([3, 4]);
  });
  it('sign is the three-valued sign', () => {
    expect(sign(-2)).toBe(-1);
    expect(sign(0)).toBe(0);
    expect(sign(2)).toBe(1);
  });
});

describe('epsilon policy', () => {
  it('treats f32-quantized values as equal at small magnitude', () => {
    // 0.1 stored through Float32 differs from the f64 literal by ~1e-9.
    const stored = Math.fround(0.1);
    expect(approxEq(stored, 0.1)).toBe(true);
  });
  it('scales tolerance with magnitude (f32 ULP at 100k ≈ 0.008)', () => {
    const big = 100_000;
    const storedBig = Math.fround(big + 0.001); // below f32 resolution there
    expect(approxEq(storedBig, big)).toBe(true);
    expect(approxEq(big, big + 1)).toBe(false); // a whole unit is still distinct
  });
  it('exposes a base epsilon at f32 scale, not f64', () => {
    expect(EPS).toBeGreaterThan(1e-7);
    expect(EPS).toBeLessThan(1e-4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/scalar.test.ts`
Expected: FAIL — `Cannot find module './scalar'`.

- [ ] **Step 3: Write the implementation**

`packages/geom/src/scalar.ts`:

```ts
/**
 * Scalar / 2-vector primitives and the kernel-wide epsilon policy.
 *
 * Points are scalar pairs (px, py); there is no point struct. All math is
 * f64 (JS-native). Epsilons are f32-SCALE and magnitude-relative, because
 * stored coords are quantized to Float32 (~7 significant digits) — see the
 * geometry-kernel spec.
 */

/** Base relative epsilon, sized for Float32 storage (~1 part in 1e-6). */
export const EPS = 1e-6;

/** 2D cross (wedge) product of vectors (ax,ay) and (bx,by). */
export function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

/** 2D dot product. */
export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** Component difference (ax-bx, ay-by) as a tuple. Cold-path use only. */
export function sub(ax: number, ay: number, bx: number, by: number): [number, number] {
  return [ax - bx, ay - by];
}

/** Squared length of (x,y). Avoids the sqrt; compare against squared thresholds. */
export function len2(x: number, y: number): number {
  return x * x + y * y;
}

/** Three-valued sign. */
export function sign(n: number): -1 | 0 | 1 {
  return n > 0 ? 1 : n < 0 ? -1 : 0;
}

/**
 * Magnitude-scaled approximate equality. Two values are equal when their
 * absolute difference is within EPS scaled by the larger magnitude. This is
 * the ONLY equality the kernel uses on computed coordinates — never `===`,
 * never an f64-tight literal.
 */
export function approxEq(a: number, b: number, eps: number = EPS): boolean {
  const diff = Math.abs(a - b);
  if (diff === 0) return true;
  const scale = Math.max(1, Math.abs(a), Math.abs(b));
  return diff <= eps * scale;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/scalar.test.ts`
Expected: PASS.

- [ ] **Step 5: Export from the barrel and commit**

Add to `packages/geom/src/index.ts`:

```ts
export { cross, dot, sub, len2, sign, approxEq, EPS } from './scalar';
```

```bash
git add packages/geom/src/scalar.ts packages/geom/src/scalar.test.ts packages/geom/src/index.ts
git commit -m "feat(geom): scalar primitives + magnitude-scaled epsilon policy"
```

---

### Task 3: Mat3 affine transforms

**Files:**
- Create: `packages/geom/src/mat3.ts`
- Test: `packages/geom/src/mat3.test.ts`

A 2D affine is six numbers in canvas/`DOMMatrix` order `[a, b, c, d, e, f]` mapping
`x' = a·x + c·y + e`, `y' = b·x + d·y + f`. Represented as a 6-element `number[]`.

> Verification note: before implementing, grep for an existing `Mat3`/affine type the renderer uses (`rg "Mat3|DOMMatrix|\[a, b, c, d, e, f\]" src/canvas src/renderer`). If one exists with a different element order, match its order here and note the deviation in a code comment — do not create a second competing convention. The tests below assume canvas order; adjust them if you align to an existing order.

- [ ] **Step 1: Write the failing test**

`packages/geom/src/mat3.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { identity, translate, scale, rotate, multiply, invert, applyToPoint, boxToBox, rotateAboutPoint } from './mat3';
import { approxEq } from './scalar';

const closePt = (got: [number, number], ex: [number, number]) => {
  expect(approxEq(got[0], ex[0])).toBe(true);
  expect(approxEq(got[1], ex[1])).toBe(true);
};

describe('mat3', () => {
  it('identity maps a point to itself', () => {
    closePt(applyToPoint(identity(), 3, 7), [3, 7]);
  });
  it('translate then apply offsets the point', () => {
    closePt(applyToPoint(translate(10, -5), 1, 1), [11, -4]);
  });
  it('scale multiplies components', () => {
    closePt(applyToPoint(scale(2, 3), 4, 5), [8, 15]);
  });
  it('rotate 90° about origin sends +x to +y', () => {
    closePt(applyToPoint(rotate(Math.PI / 2), 1, 0), [0, 1]);
  });
  it('multiply composes (right-applied first)', () => {
    // translate AFTER scale: scale first, then translate.
    const m = multiply(translate(1, 1), scale(2, 2));
    closePt(applyToPoint(m, 3, 4), [7, 9]);
  });
  it('invert round-trips any point', () => {
    const m = multiply(translate(5, -3), multiply(rotate(0.7), scale(2, 1.5)));
    const inv = invert(m)!;
    const round = applyToPoint(inv, ...applyToPoint(m, 9, -2));
    closePt(round, [9, -2]);
  });
  it('invert returns null for a degenerate (zero-determinant) matrix', () => {
    expect(invert(scale(0, 1))).toBeNull();
  });
  it('boxToBox maps the source rect corners onto the destination rect', () => {
    const m = boxToBox(0, 0, 10, 10, 100, 200, 30, 60);
    closePt(applyToPoint(m, 0, 0), [100, 200]);
    closePt(applyToPoint(m, 10, 10), [130, 260]);
    closePt(applyToPoint(m, 5, 5), [115, 230]);
  });
  it('rotateAboutPoint leaves the pivot fixed', () => {
    closePt(applyToPoint(rotateAboutPoint(4, 4, 1.1), 4, 4), [4, 4]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/mat3.test.ts`
Expected: FAIL — `Cannot find module './mat3'`.

- [ ] **Step 3: Write the implementation**

`packages/geom/src/mat3.ts`:

```ts
/**
 * 2D affine transforms in canvas/DOMMatrix order: [a, b, c, d, e, f].
 *   x' = a·x + c·y + e
 *   y' = b·x + d·y + f
 * Represented as a 6-element number[] (f64). The affine tier of the kernel.
 */
export type Mat3 = number[];

export function identity(): Mat3 {
  return [1, 0, 0, 1, 0, 0];
}

export function translate(tx: number, ty: number): Mat3 {
  return [1, 0, 0, 1, tx, ty];
}

export function scale(sx: number, sy: number): Mat3 {
  return [sx, 0, 0, sy, 0, 0];
}

export function rotate(rad: number): Mat3 {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [c, s, -s, c, 0, 0];
}

/** Compose: result applies `n` first, then `m` (m·n). */
export function multiply(m: Mat3, n: Mat3): Mat3 {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

/** Inverse, or null when the matrix is singular (|det| below the epsilon). */
export function invert(m: Mat3): Mat3 | null {
  const det = m[0] * m[3] - m[1] * m[2];
  if (Math.abs(det) < 1e-12) return null;
  const id = 1 / det;
  const a = m[3] * id;
  const b = -m[1] * id;
  const c = -m[2] * id;
  const d = m[0] * id;
  return [a, b, c, d, -(m[4] * a + m[5] * c), -(m[4] * b + m[5] * d)];
}

/** Apply to a point, returning a tuple. Cold-path use; hot loops inline. */
export function applyToPoint(m: Mat3, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** Affine that maps source box (sx,sy,sw,sh) onto destination box (dx,dy,dw,dh). */
export function boxToBox(
  sx: number, sy: number, sw: number, sh: number,
  dx: number, dy: number, dw: number, dh: number,
): Mat3 {
  const kx = sw === 0 ? 1 : dw / sw;
  const ky = sh === 0 ? 1 : dh / sh;
  // translate(dx,dy) · scale(kx,ky) · translate(-sx,-sy)
  return [kx, 0, 0, ky, dx - sx * kx, dy - sy * ky];
}

/** Rotation by `rad` about pivot (cx,cy): translate(c)·rotate·translate(-c). */
export function rotateAboutPoint(cx: number, cy: number, rad: number): Mat3 {
  return multiply(translate(cx, cy), multiply(rotate(rad), translate(-cx, -cy)));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/mat3.test.ts`
Expected: PASS.

- [ ] **Step 5: Export and commit**

Add to `packages/geom/src/index.ts`:

```ts
export { identity, translate, scale, rotate, multiply, invert, applyToPoint, boxToBox, rotateAboutPoint, type Mat3 } from './mat3';
```

```bash
git add packages/geom/src/mat3.ts packages/geom/src/mat3.test.ts packages/geom/src/index.ts
git commit -m "feat(geom): Mat3 affine transforms (invert, boxToBox, rotateAboutPoint)"
```

---

### Task 4: Box / AABB primitives

**Files:**
- Create: `packages/geom/src/box.ts`
- Test: `packages/geom/src/box.test.ts`

A box is the tuple `[minX, minY, maxX, maxY]`.

- [ ] **Step 1: Write the failing test**

`packages/geom/src/box.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { boundsOfCoords, unionBox, boxContainsPoint, rectToContour, type Box } from './box';

describe('box', () => {
  it('boundsOfCoords sweeps interleaved coords', () => {
    const b = boundsOfCoords([1, 2, 5, 1, 3, 9]);
    expect(b).toEqual([1, 1, 5, 9]);
  });
  it('boundsOfCoords of empty input is null', () => {
    expect(boundsOfCoords([])).toBeNull();
  });
  it('unionBox spans both', () => {
    const a: Box = [0, 0, 5, 5];
    const c: Box = [3, -2, 10, 4];
    expect(unionBox(a, c)).toEqual([0, -2, 10, 5]);
  });
  it('boxContainsPoint is inclusive of edges', () => {
    const b: Box = [0, 0, 10, 10];
    expect(boxContainsPoint(b, 0, 10)).toBe(true);
    expect(boxContainsPoint(b, 11, 5)).toBe(false);
  });
  it('rectToContour emits a closed 5-vertex interleaved ring', () => {
    expect(Array.from(rectToContour(0, 0, 2, 3))).toEqual([0, 0, 2, 0, 2, 3, 0, 3, 0, 0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/box.test.ts`
Expected: FAIL — `Cannot find module './box'`.

- [ ] **Step 3: Write the implementation**

`packages/geom/src/box.ts`:

```ts
/** Axis-aligned box as [minX, minY, maxX, maxY]. */
export type Box = [number, number, number, number];

/** Tight bounds of an interleaved coord stream, or null if empty. */
export function boundsOfCoords(coords: ArrayLike<number>): Box | null {
  if (coords.length < 2) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return [minX, minY, maxX, maxY];
}

/** Smallest box containing both inputs. */
export function unionBox(a: Box, b: Box): Box {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

/** Inclusive point-in-box test. */
export function boxContainsPoint(b: Box, x: number, y: number): boolean {
  return x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];
}

/** Closed interleaved ring (first vertex repeated) for a rect at (x,y,w,h). */
export function rectToContour(x: number, y: number, w: number, h: number): Float64Array {
  return Float64Array.of(x, y, x + w, y, x + w, y + h, x, y + h, x, y);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/box.test.ts`
Expected: PASS.

- [ ] **Step 5: Export and commit**

Add to `packages/geom/src/index.ts`:

```ts
export { boundsOfCoords, unionBox, boxContainsPoint, rectToContour, type Box } from './box';
```

```bash
git add packages/geom/src/box.ts packages/geom/src/box.test.ts packages/geom/src/index.ts
git commit -m "feat(geom): box/AABB primitives (bounds, union, contains, rectToContour)"
```

---

### Task 5: Command-stream constants + walker

**Files:**
- Create: `packages/geom/src/commands.ts`
- Test: `packages/geom/src/commands.test.ts`

These are geom's own canonical copy of the SVG-style command codes (lifted from
`src/features/paths/types.ts:20-30`). `features/paths` keeps its copy for now;
convergence (re-export) is Spec 2.

- [ ] **Step 1: Write the failing test**

`packages/geom/src/commands.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, forEachSegment } from './commands';

describe('command constants', () => {
  it('match the canonical SVG-style codes', () => {
    expect([PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z]).toEqual([0, 1, 2, 3, 4]);
    expect(PATH_CMD_LENGTHS).toEqual([2, 2, 6, 4, 0]);
  });
});

describe('forEachSegment', () => {
  it('walks commands with the running pen position and coord offset', () => {
    // M 0,0  L 10,0  Z
    const commands = Uint8Array.of(PATH_M, PATH_L, PATH_Z);
    const coords = Float64Array.of(0, 0, 10, 0);
    const seen: Array<[number, number, number, number]> = [];
    forEachSegment(commands, coords, (cmd, ci, px, py) => seen.push([cmd, ci, px, py]));
    expect(seen).toEqual([
      [PATH_M, 0, 0, 0],   // pen at origin before M consumes
      [PATH_L, 2, 0, 0],   // pen still at 0,0 entering the L
      [PATH_Z, 4, 10, 0],  // pen at 10,0 entering the Z
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/commands.test.ts`
Expected: FAIL — `Cannot find module './commands'`.

- [ ] **Step 3: Write the implementation**

`packages/geom/src/commands.ts`:

```ts
/**
 * SVG-style command-stream encoding — geom's canonical copy. `Path` in
 * @weasel-js/core wraps this with `kind` + `fillRule`. Codes lifted from
 * features/paths/types.ts; Spec 2 re-points that file to re-export these.
 */
export const PATH_M = 0; // moveTo
export const PATH_L = 1; // lineTo
export const PATH_C = 2; // cubic bezier
export const PATH_Q = 3; // quadratic bezier
export const PATH_Z = 4; // close subpath

/** Float coords consumed by each command, indexed by command code. */
export const PATH_CMD_LENGTHS: readonly number[] = [2, 2, 6, 4, 0];

/**
 * Visit each command with its coord offset and the pen position BEFORE the
 * command consumes its coords (the segment start). The callback receives
 * (cmd, coordIndex, penX, penY). The pen advances to the command's last
 * coord pair afterward (Z leaves the pen unchanged).
 */
export function forEachSegment(
  commands: ArrayLike<number>,
  coords: ArrayLike<number>,
  visit: (cmd: number, coordIndex: number, penX: number, penY: number) => void,
): void {
  let ci = 0;
  let px = 0, py = 0;
  for (let i = 0; i < commands.length; i++) {
    const cmd = commands[i];
    visit(cmd, ci, px, py);
    const len = PATH_CMD_LENGTHS[cmd];
    if (len > 0) {
      px = coords[ci + len - 2];
      py = coords[ci + len - 1];
      ci += len;
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/commands.test.ts`
Expected: PASS.

- [ ] **Step 5: Export and commit**

Add to `packages/geom/src/index.ts`:

```ts
export { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z, PATH_CMD_LENGTHS, forEachSegment } from './commands';
```

```bash
git add packages/geom/src/commands.ts packages/geom/src/commands.test.ts packages/geom/src/index.ts
git commit -m "feat(geom): canonical command-stream constants + segment walker"
```

---

### Task 6: Curve tier — cubic eval, Q→C elevation, flatten, extrema, split

**Files:**
- Create: `packages/geom/src/curve.ts`
- Test: `packages/geom/src/curve.test.ts`

Port `flattenCubic` from `src/features/paths/flatten.ts:37` and the cubic-extrema logic
from `src/features/paths/bounds.ts` (see its header doc at lines 9-16). Quadratics are
degree-elevated to cubics rather than handled separately.

- [ ] **Step 1: Write the failing test**

`packages/geom/src/curve.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cubicEvalAt, elevateQuadraticToCubic, flattenCubic, cubicBounds } from './curve';
import { approxEq } from './scalar';

describe('cubicEvalAt', () => {
  it('hits the endpoints at t=0 and t=1', () => {
    const p0: [number, number] = [0, 0], p1: [number, number] = [1, 2], p2: [number, number] = [3, 2], p3: [number, number] = [4, 0];
    expect(cubicEvalAt(...p0, ...p1, ...p2, ...p3, 0)).toEqual([0, 0]);
    expect(cubicEvalAt(...p0, ...p1, ...p2, ...p3, 1)).toEqual([4, 0]);
  });
});

describe('elevateQuadraticToCubic', () => {
  it('produces a cubic that samples identically to the quadratic', () => {
    // quad: q0=(0,0) c=(2,4) q1=(4,0). Elevated cubic control points:
    //   c1 = q0 + 2/3 (c - q0),  c2 = q1 + 2/3 (c - q1)
    const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(0, 0, 2, 4, 4, 0);
    expect(approxEq(c1x, 4 / 3)).toBe(true);
    expect(approxEq(c1y, 8 / 3)).toBe(true);
    expect(approxEq(c2x, 8 / 3)).toBe(true);
    expect(approxEq(c2y, 8 / 3)).toBe(true);
    // sample agreement at t=0.5: quad B(0.5)=(2,2); cubic must match.
    const cub = cubicEvalAt(0, 0, c1x, c1y, c2x, c2y, 4, 0, 0.5);
    expect(approxEq(cub[0], 2)).toBe(true);
    expect(approxEq(cub[1], 2)).toBe(true);
  });
});

describe('flattenCubic', () => {
  it('emits points within tolerance, ending at the endpoint', () => {
    const out: number[] = [];
    flattenCubic(0, 0, 0, 10, 10, 10, 10, 0, 0.5, out);
    expect(out.length).toBeGreaterThanOrEqual(2);
    expect(approxEq(out[out.length - 2], 10)).toBe(true);
    expect(approxEq(out[out.length - 1], 0)).toBe(true);
  });
});

describe('cubicBounds', () => {
  it('is tight — a symmetric arch peaks at y=7.5, not the control y=10', () => {
    // cubic with control points pulling to y=10 actually reaches y=7.5 at apex.
    const b = cubicBounds(0, 0, 0, 10, 10, 10, 10, 0);
    expect(approxEq(b[0], 0)).toBe(true);   // minX
    expect(approxEq(b[1], 0)).toBe(true);   // minY
    expect(approxEq(b[2], 10)).toBe(true);  // maxX
    expect(approxEq(b[3], 7.5)).toBe(true); // maxY (curve apex < control hull)
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/curve.test.ts`
Expected: FAIL — `Cannot find module './curve'`.

- [ ] **Step 3: Write the implementation**

`packages/geom/src/curve.ts`. Copy the body of `flattenCubic` verbatim from
`src/features/paths/flatten.ts:37-62` into the `flattenCubic` below (same signature). The
rest is new:

```ts
import type { Box } from './box';

/** Cubic Bezier point at parameter t (de Casteljau / Bernstein form). */
export function cubicEvalAt(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, t: number,
): [number, number] {
  const u = 1 - t;
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t;
  return [
    a * x0 + b * x1 + c * x2 + d * x3,
    a * y0 + b * y1 + c * y2 + d * y3,
  ];
}

/**
 * Degree-elevate a quadratic (q0, ctrl, q1) to a cubic. Returns the two
 * cubic control points [c1x, c1y, c2x, c2y]; the cubic endpoints equal the
 * quadratic endpoints. c1 = q0 + 2/3(ctrl-q0), c2 = q1 + 2/3(ctrl-q1).
 */
export function elevateQuadraticToCubic(
  q0x: number, q0y: number, cx: number, cy: number, q1x: number, q1y: number,
): [number, number, number, number] {
  return [
    q0x + (2 / 3) * (cx - q0x),
    q0y + (2 / 3) * (cy - q0y),
    q1x + (2 / 3) * (cx - q1x),
    q1y + (2 / 3) * (cy - q1y),
  ];
}

/**
 * Adaptive flatten of a cubic into interleaved points appended to `out`
 * (excludes the start point, includes the endpoint). Ported verbatim from
 * features/paths/flatten.ts:37.
 */
export function flattenCubic(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
  tolerance: number, out: number[],
): void {
  // <<< PASTE THE BODY OF features/paths/flatten.ts flattenCubic HERE >>>
  // (identical signature; verify by diffing against the source after pasting)
}

/** Axis-aligned extrema parameters of one cubic component (the 0,1 ends plus
 *  any derivative roots in (0,1)). Used by cubicBounds. */
function componentExtremaTs(p0: number, p1: number, p2: number, p3: number): number[] {
  // B'(t)=0 → quadratic a t² + b t + c = 0 with:
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = -p0 + p1;
  const ts: number[] = [];
  const push = (t: number) => { if (t > 0 && t < 1) ts.push(t); };
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) push(-c / b);
  } else {
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const sq = Math.sqrt(disc);
      push((-b + sq) / (2 * a));
      push((-b - sq) / (2 * a));
    }
  }
  return ts;
}

/** Tight AABB of a cubic, evaluating only extrema that lie on the curve. */
export function cubicBounds(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number,
): Box {
  let minX = Math.min(x0, x3), maxX = Math.max(x0, x3);
  let minY = Math.min(y0, y3), maxY = Math.max(y0, y3);
  for (const t of componentExtremaTs(x0, x1, x2, x3)) {
    const [ex] = cubicEvalAt(x0, y0, x1, y1, x2, y2, x3, y3, t);
    if (ex < minX) minX = ex; if (ex > maxX) maxX = ex;
  }
  for (const t of componentExtremaTs(y0, y1, y2, y3)) {
    const [, ey] = cubicEvalAt(x0, y0, x1, y1, x2, y2, x3, y3, t);
    if (ey < minY) minY = ey; if (ey > maxY) maxY = ey;
  }
  return [minX, minY, maxX, maxY];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/curve.test.ts`
Expected: PASS. (If `flattenCubic` paste is wrong, the flatten test fails on the endpoint assertion.)

- [ ] **Step 5: Export and commit**

Add to `packages/geom/src/index.ts`:

```ts
export { cubicEvalAt, elevateQuadraticToCubic, flattenCubic, cubicBounds } from './curve';
```

```bash
git add packages/geom/src/curve.ts packages/geom/src/curve.test.ts packages/geom/src/index.ts
git commit -m "feat(geom): curve tier — eval, Q->C elevation, flatten, tight cubic bounds"
```

---

### Task 7: Polyline tier — point-in-polygon, segment cross, point-segment distance (flat)

**Files:**
- Create: `packages/geom/src/polyline.ts`
- Test: `packages/geom/src/polyline.test.ts`

This is the flat rewrite of `pointInPolygon`/`segmentsCross` from
`src/features/paths/polygonHitTestRect.ts:13,93` — same algorithms, consuming interleaved
coords instead of `Vec2[]`. The test pins agreement with the original `{x,y}` version on a
non-convex polygon so the rewrite is provably equivalent.

- [ ] **Step 1: Write the failing test**

`packages/geom/src/polyline.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pointInPolygon, segmentsCross, pointSegmentDist2 } from './polyline';
import { approxEq } from './scalar';

// An L-shaped (non-convex) polygon, interleaved & unclosed.
const L = [0, 0, 4, 0, 4, 2, 2, 2, 2, 4, 0, 4];

describe('pointInPolygon (flat, even-odd)', () => {
  it('inside the lower arm', () => expect(pointInPolygon(L, 1, 1)).toBe(true));
  it('inside the upper arm', () => expect(pointInPolygon(L, 1, 3)).toBe(true));
  it('in the notch (outside)', () => expect(pointInPolygon(L, 3, 3)).toBe(false));
  it('far outside', () => expect(pointInPolygon(L, 9, 9)).toBe(false));
  it('degenerate (<3 verts) is false', () => expect(pointInPolygon([0, 0, 1, 1], 0, 0)).toBe(false));
});

describe('segmentsCross', () => {
  it('crossing diagonals intersect', () => {
    expect(segmentsCross(0, 0, 4, 4, 0, 4, 4, 0)).toBe(true);
  });
  it('parallel segments do not', () => {
    expect(segmentsCross(0, 0, 4, 0, 0, 1, 4, 1)).toBe(false);
  });
});

describe('pointSegmentDist2', () => {
  it('perpendicular distance squared to a segment', () => {
    expect(approxEq(pointSegmentDist2(2, 3, 0, 0, 4, 0), 9)).toBe(true);
  });
  it('clamps to the nearer endpoint past the end', () => {
    expect(approxEq(pointSegmentDist2(-3, 0, 0, 0, 4, 0), 9)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/polyline.test.ts`
Expected: FAIL — `Cannot find module './polyline'`.

- [ ] **Step 3: Write the implementation**

`packages/geom/src/polyline.ts`:

```ts
import { sign, dot, len2 } from './scalar';

/**
 * Even-odd ray-cast point-in-polygon over an interleaved, unclosed contour
 * [x0,y0,x1,y1,…]. The closing edge (last→first) is implicit. Flat rewrite of
 * features/paths/polygonHitTestRect.ts pointInPolygon — same algorithm.
 */
export function pointInPolygon(coords: ArrayLike<number>, px: number, py: number): boolean {
  const n = coords.length >> 1;
  if (n < 3) return false;
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = coords[i * 2], yi = coords[i * 2 + 1];
    const xj = coords[j * 2], yj = coords[j * 2 + 1];
    const crosses =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

/** True if segment (ax,ay)-(bx,by) properly crosses (cx,cy)-(dx,dy). Flat
 *  rewrite of polygonHitTestRect.ts segmentsCross. */
export function segmentsCross(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const d1 = sign((dx - cx) * (ay - cy) - (dy - cy) * (ax - cx));
  const d2 = sign((dx - cx) * (by - cy) - (dy - cy) * (bx - cx));
  const d3 = sign((bx - ax) * (cy - ay) - (by - ay) * (cx - ax));
  const d4 = sign((bx - ax) * (dy - ay) - (by - ay) * (dx - ax));
  return d1 !== d2 && d3 !== d4;
}

/** Squared distance from (px,py) to segment (ax,ay)-(bx,by), endpoint-clamped. */
export function pointSegmentDist2(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const vv = len2(vx, vy);
  let t = vv === 0 ? 0 : dot(wx, wy, vx, vy) / vv;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return len2(dx, dy);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/polyline.test.ts`
Expected: PASS.

- [ ] **Step 5: Export and commit**

Add to `packages/geom/src/index.ts`:

```ts
export { pointInPolygon, segmentsCross, pointSegmentDist2 } from './polyline';
```

```bash
git add packages/geom/src/polyline.ts packages/geom/src/polyline.test.ts packages/geom/src/index.ts
git commit -m "feat(geom): polyline tier — flat point-in-polygon, segment-cross, point-seg dist"
```

---

### Task 8: Affine tier — transform a coord stream

**Files:**
- Create: `packages/geom/src/affine.ts`
- Test: `packages/geom/src/affine.test.ts`

The exact, curve-preserving operation: apply a `Mat3` to every coord pair, leaving the
command stream untouched (affine invariance of béziers).

- [ ] **Step 1: Write the failing test**

`packages/geom/src/affine.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { transformCoords } from './affine';
import { multiply, translate, rotate, scale, applyToPoint } from './mat3';
import { cubicEvalAt } from './curve';
import { approxEq } from './scalar';

describe('transformCoords', () => {
  it('applies the matrix to every coord pair, returns Float64Array', () => {
    const out = transformCoords(Float32Array.of(0, 0, 1, 0), translate(10, 5));
    expect(out).toBeInstanceOf(Float64Array);
    expect(Array.from(out)).toEqual([10, 5, 11, 5]);
  });
  it('preserves curves under affine: transformed control points define the transformed curve', () => {
    const m = multiply(translate(3, -2), multiply(rotate(0.6), scale(2, 1.4)));
    const ctrl = Float32Array.of(0, 0, 1, 3, 4, 3, 5, 0); // one cubic's 4 points
    const moved = transformCoords(ctrl, m);
    // Sample the original curve at t, transform the sample; compare to the
    // same sample of the moved curve. Affine invariance ⇒ they coincide.
    for (const t of [0.25, 0.5, 0.75]) {
      const s = cubicEvalAt(ctrl[0], ctrl[1], ctrl[2], ctrl[3], ctrl[4], ctrl[5], ctrl[6], ctrl[7], t);
      const sMoved = applyToPoint(m, s[0], s[1]);
      const onMoved = cubicEvalAt(moved[0], moved[1], moved[2], moved[3], moved[4], moved[5], moved[6], moved[7], t);
      expect(approxEq(onMoved[0], sMoved[0])).toBe(true);
      expect(approxEq(onMoved[1], sMoved[1])).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/affine.test.ts`
Expected: FAIL — `Cannot find module './affine'`.

- [ ] **Step 3: Write the implementation**

`packages/geom/src/affine.ts`:

```ts
import type { Mat3 } from './mat3';

/**
 * Apply an affine to an interleaved coord stream, returning a fresh f64
 * buffer. Command codes are unaffected — for a Bezier the transformed control
 * points define the transformed curve exactly (affine invariance), so callers
 * pass `path.coords` straight through and keep `path.commands` as-is.
 */
export function transformCoords(coords: ArrayLike<number>, m: Mat3): Float64Array {
  const out = new Float64Array(coords.length);
  const a = m[0], b = m[1], c = m[2], d = m[3], e = m[4], f = m[5];
  for (let i = 0; i + 1 < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    out[i] = a * x + c * y + e;
    out[i + 1] = b * x + d * y + f;
  }
  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/affine.test.ts`
Expected: PASS.

- [ ] **Step 5: Export and commit**

Add to `packages/geom/src/index.ts`:

```ts
export { transformCoords } from './affine';
```

```bash
git add packages/geom/src/affine.ts packages/geom/src/affine.test.ts packages/geom/src/index.ts
git commit -m "feat(geom): affine tier — curve-preserving coord-stream transform"
```

---

### Task 9: Booleans subpath (port pathUnion/Intersect/Subtract/Exclude/Divide)

**Files:**
- Create: `packages/geom/src/booleans/adapter.ts`
- Create: `packages/geom/src/booleans/index.ts`
- Test: `packages/geom/src/booleans/booleans.test.ts`

Port from `src/features/paths/booleans.ts` + `booleans.adapter.ts`. The adapter is moved
nearly verbatim, with two changes: (1) it imports command codes from `../commands` and
flatten from `../curve` instead of `features/paths`; (2) it operates on
`(commands, coords)` arrays plus a `kind` flag rather than the `Path` type, since geom does
not import `Path`. Define a minimal local input shape.

- [ ] **Step 1: Write the failing test** (ported from `src/features/paths/booleans.test.ts`, using geom's own point-in-polygon to assert coverage instead of the kit's `pointInPath`)

`packages/geom/src/booleans/booleans.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { pathUnion, pathIntersect, type GeomPath } from './index';
import { pointInPolygon } from '../polyline';
import { PATH_M, PATH_L, PATH_Z } from '../commands';

const rect = (x: number, y: number, w: number, h: number): GeomPath => ({ kind: 'rect', x, y, width: w, height: h });

// Collect every contour vertex of a polygon result into one interleaved ring
// for a coarse coverage check (results here are single-contour).
const ring = (p: GeomPath): number[] => {
  if (p.kind === 'rect') throw new Error('expected polygon');
  const out: number[] = [];
  for (let i = 0, ci = 0; i < p.commands.length; i++) {
    const cmd = p.commands[i];
    if (cmd === PATH_M || cmd === PATH_L) { out.push(p.coords[ci], p.coords[ci + 1]); ci += 2; }
  }
  return out;
};

describe('pathUnion', () => {
  it('overlapping rects union to a shape covering both', () => {
    const u = pathUnion(rect(0, 0, 10, 10), rect(5, 5, 10, 10));
    const r = ring(u);
    expect(pointInPolygon(r, 2, 2)).toBe(true);
    expect(pointInPolygon(r, 12, 12)).toBe(true);
    expect(pointInPolygon(r, 20, 20)).toBe(false);
  });
});

describe('pathIntersect', () => {
  it('returns only the overlap of two overlapping rects', () => {
    const i = pathIntersect(rect(0, 0, 10, 10), rect(5, 5, 10, 10));
    const r = ring(i);
    expect(pointInPolygon(r, 7, 7)).toBe(true);
    expect(pointInPolygon(r, 2, 2)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:ui -- packages/geom/src/booleans/booleans.test.ts`
Expected: FAIL — `Cannot find module './index'`.

- [ ] **Step 3: Write the adapter** (`packages/geom/src/booleans/adapter.ts`)

Copy `pathToMultiPolygon` and `multiPolygonToPath` from
`src/features/paths/booleans.adapter.ts:34-158` verbatim, then make exactly these edits:
- Replace the imports header with:

```ts
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z } from '../commands';
import { flattenCubic, elevateQuadraticToCubic } from '../curve';

/** Minimal path input: a rect or a polygon command stream. geom does not
 *  import @weasel-js/core's `Path`; the kit maps `Path` onto this shape. */
export type GeomPath =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'polygon'; commands: ArrayLike<number>; coords: ArrayLike<number>; fillRule?: 'nonzero' | 'evenodd' };

const DEFAULT_FLATTEN_TOLERANCE = 0.5;

export type Pair = [number, number];
export type Ring = Pair[];
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];
```

- In the `PATH_Q` case, replace the `flattenQuadratic(...)` call (which geom does not provide) with degree-elevation then `flattenCubic`:

```ts
      case PATH_Q: {
        const x1 = coords[ci], y1 = coords[ci + 1];
        const x2 = coords[ci + 2], y2 = coords[ci + 3];
        const [c1x, c1y, c2x, c2y] = elevateQuadraticToCubic(cx, cy, x1, y1, x2, y2);
        const out: number[] = [];
        flattenCubic(cx, cy, c1x, c1y, c2x, c2y, x2, y2, tolerance, out);
        if (current) for (let k = 0; k < out.length; k += 2) current.push([out[k], out[k + 1]]);
        cx = x2; cy = y2;
        ci += 4;
        break;
      }
```

- Change the two function signatures from `path: Path` / returns `PolygonPath` to `path: GeomPath` and the polygon return type `{ kind: 'polygon'; commands: Uint8Array; coords: Float32Array; fillRule: 'nonzero' }`. The body is otherwise unchanged. `multiPolygonToPath` already emits `Uint8Array`/`Float32Array` — leave it.

- [ ] **Step 4: Write the boolean ops** (`packages/geom/src/booleans/index.ts`)

Port from `src/features/paths/booleans.ts:16-` verbatim, swapping the import line and the `Path`/`PolygonPath` types for `GeomPath` and the returned polygon shape:

```ts
import polygonClipping from 'polygon-clipping';
import { pathToMultiPolygon, multiPolygonToPath, type GeomPath } from './adapter';

export type { GeomPath } from './adapter';

/** Union of N paths. */
export function pathUnion(...paths: GeomPath[]): GeomPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.union(head, ...rest));
}

/** Intersection of N paths. */
export function pathIntersect(...paths: GeomPath[]): GeomPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.intersection(head, ...rest));
}

/** Asymmetric difference a − b. */
export function pathSubtract(a: GeomPath, b: GeomPath): GeomPath {
  return multiPolygonToPath(polygonClipping.difference(pathToMultiPolygon(a), pathToMultiPolygon(b)));
}

/** Symmetric difference (XOR) of N paths. */
export function pathExclude(...paths: GeomPath[]): GeomPath {
  if (paths.length === 0) return multiPolygonToPath([]);
  const mps = paths.map((p) => pathToMultiPolygon(p));
  const [head, ...rest] = mps;
  return multiPolygonToPath(polygonClipping.xor(head, ...rest));
}
```

For `pathDivide`, copy the full implementation from `src/features/paths/booleans.ts` (the
subset-fracture loop documented at its lines 53-) verbatim, swapping `Path`→`GeomPath` and
the return type the same way; it composes the four ops above plus `pathToMultiPolygon`/
`multiPolygonToPath`. If the source `pathDivide` references helpers beyond those, port them
into `index.ts` alongside it.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:ui -- packages/geom/src/booleans/booleans.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/geom/src/booleans
git commit -m "feat(geom): booleans subpath — port path boolean ops onto the kernel"
```

---

### Task 10: Full verification + barrel finalization

**Files:**
- Modify: `packages/geom/src/index.ts` (remove the scaffold placeholder)
- Delete: `packages/geom/src/scaffold.test.ts`

- [ ] **Step 1: Remove the scaffold placeholder** from `packages/geom/src/index.ts` (delete the `GEOM_PACKAGE` line; keep all tier re-exports). Delete `packages/geom/src/scaffold.test.ts`.

- [ ] **Step 2: Typecheck the whole repo**

Run: `npm run typecheck`
Expected: PASS — confirms the package + paths entries are sound and nothing in `src/` was disturbed.

- [ ] **Step 3: Run the full geom suite via the weasel-ui project**

Run: `npm run test:ui -- packages/geom`
Expected: PASS — every tier test green.

- [ ] **Step 4: Run the kit + draw suites to confirm zero regressions** (this plan touched no `src/` runtime code, so they must be unaffected)

Run: `npm run test:unit`
Expected: PASS (same result as before this branch).

- [ ] **Step 5: Verify the subpath export resolves** by adding a temporary import probe, then reverting it:

Run: `node -e "process.exit(0)"` is insufficient (TS source). Instead confirm via a throwaway test already covered — the booleans test imports `@weasel-js/geom/booleans` indirectly through `./index`; add one assertion file `packages/geom/src/exports.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import * as core from '@weasel-js/geom';
import { pathUnion } from '@weasel-js/geom/booleans';

describe('package exports', () => {
  it('core barrel exposes the tiers', () => {
    for (const name of ['cross', 'boxToBox', 'pointInPolygon', 'transformCoords', 'cubicBounds', 'forEachSegment']) {
      expect(typeof (core as Record<string, unknown>)[name]).toBe('function');
    }
  });
  it('booleans subpath resolves', () => {
    expect(typeof pathUnion).toBe('function');
  });
});
```

Run: `npm run test:ui -- packages/geom/src/exports.test.ts`
Expected: PASS — proves both `@weasel-js/geom` and `@weasel-js/geom/booleans` resolve through the alias + tsconfig paths.

- [ ] **Step 6: Commit**

```bash
git add packages/geom/src/index.ts packages/geom/src/exports.test.ts
git rm packages/geom/src/scaffold.test.ts
git commit -m "feat(geom): finalize barrel + verify package and booleans subpath resolution"
```

---

## Self-Review

**Spec coverage:**
- Representation (flat-everywhere, no point struct, `[x,y]`/out-param returns) → Tasks 2-8, enforced by the conventions header and tested in Task 7/8. ✓
- Precision (f64 compute / f32 storage, magnitude-scaled epsilon) → Task 2 (`approxEq`/`EPS`), Task 8 (Float64Array output). ✓
- Three tiers + shared scalar/Mat3 base → Tasks 2 (scalar), 3 (Mat3), 6 (curve), 7 (polyline), 8 (affine). ✓
- Q→C elevation removes the cubic/quad fork → Task 6 (`elevateQuadraticToCubic`), used in Task 9's `PATH_Q` case. ✓
- Command-stream constants owned by geom → Task 5. ✓
- Booleans: geometry half in `/booleans` subpath, clipper isolated there → Task 1 (package.json dep on subpath), Task 9. ✓
- Packaging: `packages/geom`, source-exported, `deps: {}` core + clipper on the subpath, dependency-walled → Task 1. ✓
- Regression-contract test → correctly deferred to Spec 2 (noted in scope); kernel property tests present per tier. ✓

**Placeholder scan:** One intentional, clearly-bounded paste directive in Task 6 Step 3 (`flattenCubic` body copied verbatim from a cited source file:line) and Task 9 (adapter/ops ported from cited sources). These are explicit "copy this exact existing function" instructions with the source location and a post-paste verification, not vague TODOs — appropriate for a port-heavy plan. No other placeholders.

**Type consistency:** `Box` = `[minX,minY,maxX,maxY]` (Tasks 4, 6) consistent. `Mat3` = 6-number canvas-order (Task 3) used identically in Tasks 8/9. `GeomPath` defined in Task 9 adapter, re-exported and used in the boolean ops + test. `forEachSegment`/`PATH_*` names consistent Tasks 5/9. `approxEq`/`EPS` consistent throughout.

**Scope:** Single subsystem (the kernel package), additive only. Migration is Spec 2. Focused enough for one plan.
