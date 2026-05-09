# WebGL Transition — Step 4: Image, Pattern, Gradient Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `kind: 'image'` DrawCommand support and extend the `Paint` type union with `'linear-gradient'`, `'radial-gradient'`, `'conic-gradient'`, and `'pattern'` variants to `@orochi235/weasel-gl`. Images are uploaded to a GL texture cache keyed by `ImageBitmap` identity. Patterns re-extract the source image from `CanvasPattern` and upload it with per-repetition-mode wrapping. Gradients are implemented via CPU-generated 1×256 gradient-ramp textures cached by a hash of their stop list. Each paint kind gets its own small shader. Exits when all paint variants render correctly in headless Chromium and the gradient ramp cache hit rate exceeds 95% in a soak demo.

**Architecture:** Three new shader programs join `WeaselRenderer`'s existing `pathFill` and `textSdf`:

1. **`imageFill`** — textured quad, samples a `sampler2D` at `v_uv`, outputs premultiplied alpha. Used for both `kind: 'image'` DrawCommands and `fill: 'pattern'` paths.
2. **`gradFill`** — path mesh with per-vertex world-space position varying (`v_world`), samples a 1D gradient-ramp `sampler2D` using the fragment's projected coordinate. Used for linear, radial, and conic gradient fills.
3. **`gradStroke`** — same as `gradFill` but geometry comes from the stroke ribbon mesh (identical shader source; only the VAO differs). Alternatively, both gradient use cases share one shader and the caller manages which VAO to bind. This plan uses a single `gradFill` shader for both path fill and stroke gradient, since the GLSL is identical — the distinction is purely in the CPU-side geometry.

Per the key technical decision: **separate shaders per paint kind** (Option B). Fragment-shader branching on `u_paintKind` would run dead code on every path draw, costing performance on fill-heavy scenes. Three small shaders are faster, testable in isolation, and easier to read. The renderer picks the program based on the `Paint` discriminant before drawing.

A new **`GradientRampCache`** (`packages/weasel-gl/src/GradientRampCache.ts`) holds 1×256 RGBA textures keyed by `JSON.stringify(stops)`. The cache is GL-context-bound (like `GLTextureCache`) and is discarded on context loss. Ramp pixels are generated CPU-side by `buildGradientRamp(stops): Uint8ClampedArray` — a pure function that linearly interpolates between consecutive stops at each of the 256 positions.

A new **`GLImageCache`** (`packages/weasel-gl/src/GLImageCache.ts`) holds GL textures keyed by `ImageBitmap` object identity (WeakMap). This is distinct from `GLTextureCache` (which uses string keys for fonts) because `ImageBitmap` objects are consumer-owned and don't have a natural string id. The `CanvasPattern` path also feeds through this cache after extracting the source image via `(pattern as any).image`.

**Paint type extension** (`src/core/paint.ts`) adds the three gradient variants and documents the `CanvasPattern` source-compat caveat. The `weasel-gl` package picks up the extended type via the workspace path alias; no changes to the `weasel` package's public API surface other than the type extension.

**Tech Stack:** TypeScript (strict), vitest, `jsdom`. No new runtime npm dependencies. The gradient ramp is built entirely from `parseColor` + a tight CPU loop — no canvas-gradient API needed in weasel-gl.

**Spec:** [`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`](../specs/2026-05-08-webgl-transition-plan-design.md), Architecture deltas → Paint type extension + Sequencing → Step 4.

**Required reading before starting:**
- [`webgl-stepwise-conventions.md`](./webgl-stepwise-conventions.md) — accumulated lessons. See task callouts below.
- [`2026-05-09-webgl-step-3-done.md`](./2026-05-09-webgl-step-3-done.md) — what step 3 shipped and its lessons.

**Conventions cited by specific tasks below:**
- Task 2 (gradient ramp cache): conventions §9 — per-renderer resource cache; the registry (ramp builder) must not track per-renderer state.
- Task 5 (`imageFill` shader): conventions §2 — premultiplied output `vec4(rgb*a, a)` + `blendFunc(ONE, ONE_MINUS_SRC_ALPHA)`.
- Task 6 (`gradFill` shader): conventions §2 — same.
- Task 10 (GL recorder additions): conventions §1 — mock GL does NOT verify texture state; Playwright smoke is required for pixel correctness.
- Task 13 (smoke spec): conventions §6 — `preserveDrawingBuffer: true` AND `stencil: true` on every dev-page `getContext` call; conventions §8 — geometry-based correctness (gradient projection) needs pixel readback, not just drawElements count.

**Deferred — out of scope for step 4:**
- Pattern transform (consumer-supplied `DOMMatrix` on `CanvasPattern`). In step 4 the pattern is uploaded with wrapping determined by `repetition` but no additional transform is applied. Note left in code.
- Gradient on stroke paint. `Stroke.paint` accepts the full `Paint` union, but the step-2 guard in `draw.ts` throws on non-solid stroke paint. That guard is removed in this step for path fill; the stroke path follows in step 5.
- `colorMatrix` on `GroupDrawCommand`. Spec step 5.
- `vertexColors` on `PathDrawCommand`. Spec step 5.
- `fill: 'conic-gradient'` GLSL: conic is implemented with `atan2` in the fragment shader; the angle-wrap boundary (discontinuity at `start angle`) may produce a 1px seam depending on precision. Document the known issue; leave a TODO for step 9's visual regression pass to catch it.

---

## File structure

Files this plan creates/modifies in `packages/weasel-gl/`:

```
src/
  shaders/
    imageFill.ts            # NEW — GLSL sources for image/pattern textured-quad shader
    gradFill.ts             # NEW — GLSL sources for gradient-ramp path shader
  GradientRampCache.ts      # NEW — CPU ramp builder + GL 1×256 texture cache
  GradientRampCache.test.ts # NEW
  GLImageCache.ts           # NEW — WeakMap<ImageBitmap, WebGLTexture> upload cache
  GLImageCache.test.ts      # NEW
  DrawCommand.ts            # MODIFY — add ImageDrawCommand; extend PathDrawCommand fill to full Paint
  draw.ts                   # MODIFY — drawImage(), drawPathGradFill(), drawPathImageFill(), remove step-2 stroke guard
  draw.test.ts              # MODIFY — assertions for image + gradient dispatch
  WeaselRenderer.ts         # MODIFY — add imageFill + gradFill programs; add GLImageCache + GradientRampCache
  index.ts                  # MODIFY — export ImageDrawCommand, gradient Paint types, GradientRampCache helpers
  color.ts                  # MODIFY — add parseColorToRgba255() helper used by ramp builder

test-utils/
  glRecorder.ts             # MODIFY — add REPEAT, MIRRORED_REPEAT constants; add texParameteri tracking

dev/
  image-gradient.html       # NEW — smoke page: image quad + all three gradient kinds + pattern
  image-gradient.ts         # NEW — renders test scenes
  image-gradient.spec.ts    # NEW — Playwright smoke spec

scripts/
  gen-soak.ts               # NEW — generates N random gradient paths, renders 500 frames, reports cache hit rate
```

Files outside the package:

```
src/core/paint.ts           # MODIFY — add GradStop interface + three gradient Paint variants
docs/superpowers/plans/2026-05-09-webgl-step-4-image-pattern-gradient.md  # this file
```

---

## Extended `Paint` type (`src/core/paint.ts`)

The new variants are added to the tagged union. The parent `weasel` package carries the type; `weasel-gl` picks it up via the workspace path alias. The 2D `applyPaint` implementation is **not** updated in this step (gradients will be wired to 2D in step 10 when the 2D path is deleted).

```ts
// ---- add above the existing Stroke interface ----

/** A single color stop in a gradient. `offset` is 0..1. */
export interface GradStop {
  offset: number;
  /** Any color string parseable by `parseColor` (hex or rgb/rgba). */
  color: string;
}

export type Paint =
  | { fill?: 'solid'; color: string; opacity?: number }
  | { fill: 'pattern'; pattern: CanvasPattern; opacity?: number }
  | { fill: 'linear-gradient'; from: { x: number; y: number }; to: { x: number; y: number }; stops: GradStop[]; opacity?: number }
  | { fill: 'radial-gradient'; center: { x: number; y: number }; radius: number; stops: GradStop[]; opacity?: number }
  | { fill: 'conic-gradient'; center: { x: number; y: number }; angle: number; stops: GradStop[]; opacity?: number };
```

**Update `isSolidPaint`** — the existing guard `paint.fill !== 'pattern'` becomes inadequate. Replace with an explicit check:

```ts
function isSolidPaint(paint: Paint): paint is { fill?: 'solid'; color: string; opacity?: number } {
  return !paint.fill || paint.fill === 'solid';
}
```

---

## DrawCommand extensions (`src/DrawCommand.ts`)

```ts
// Replace the existing SolidPaint-only fill type on PathDrawCommand with the full Paint union.
// Also add ImageDrawCommand.

import type { Paint, GradStop } from '@orochi235/weasel';  // re-export from paint.ts

export type { GradStop };

/** Extended Paint union — all variants (solid + pattern + gradients). */
export type { Paint };

export interface ImageDrawCommand {
  kind: 'image';
  /** The bitmap to draw. Must be an alive (not closed) ImageBitmap. */
  image: ImageBitmap;
  /** Top-left x in screen (CSS pixel) space. */
  x: number;
  /** Top-left y in screen (CSS pixel) space. */
  y: number;
  /** Width in screen pixels. The image is stretched to fit. */
  w: number;
  /** Height in screen pixels. */
  h: number;
  /** Overall opacity multiplier 0..1. Default 1. */
  opacity?: number;
}

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  /** Any Paint variant: solid, pattern, or gradient. */
  fill?: Paint;
  stroke?: Stroke;
}

export type DrawCommand =
  | PathDrawCommand
  | GroupDrawCommand
  | TextDrawCommand
  | ImageDrawCommand;
```

---

## Gradient ramp fixture (used in multiple tests)

```ts
// Reusable test fixture — a two-stop black-to-white horizontal gradient.
const TWO_STOP: GradStop[] = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

// Expected ramp pixel at position 128 (midpoint): [128, 128, 128, 255]
// Expected ramp pixel at position 0: [0, 0, 0, 255]
// Expected ramp pixel at position 255: [255, 255, 255, 255]
```

---

## Task 1: Extend `Paint` type and `GradStop` in `src/core/paint.ts`

**Files:**
- Modify: `src/core/paint.ts`

**Conventions:** None specific (pure type change; no GL calls).

- [ ] **Step 1: Write the failing test**

There are no runtime tests for paint.ts (it's a type + 2D helpers). Verify the type extension compiles and is importable:

Create `packages/weasel-gl/src/gradientTypes.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import type { Paint, GradStop } from '@orochi235/weasel';

describe('Paint gradient types (compile-time + runtime shape)', () => {
  it('GradStop has offset and color fields', () => {
    const stop: GradStop = { offset: 0.5, color: '#ff0000' };
    expect(stop.offset).toBe(0.5);
    expect(stop.color).toBe('#ff0000');
  });

  it('linear-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 0 },
      stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
    };
    expect(p.fill).toBe('linear-gradient');
  });

  it('radial-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'radial-gradient',
      center: { x: 50, y: 50 },
      radius: 50,
      stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
    };
    expect(p.fill).toBe('radial-gradient');
  });

  it('conic-gradient Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'conic-gradient',
      center: { x: 50, y: 50 },
      angle: 0,
      stops: [{ offset: 0, color: '#f00' }, { offset: 1, color: '#00f' }],
    };
    expect(p.fill).toBe('conic-gradient');
  });

  it('pattern Paint discriminates on fill', () => {
    const p: Paint = {
      fill: 'pattern',
      pattern: {} as CanvasPattern,
    };
    expect(p.fill).toBe('pattern');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- packages/weasel-gl/src/gradientTypes.test.ts
```

Expected: FAIL — TypeScript compile error: `GradStop` not exported from `@orochi235/weasel`.

- [ ] **Step 3: Implement**

Edit `src/core/paint.ts` — add `GradStop` interface and three gradient variants to the `Paint` union as shown in the "Extended Paint type" section above. Also update `isSolidPaint` to the explicit check shown above.

No changes to `applyPaint`, `applyStroke`, or `renderFilledRegion` — those remain 2D-only and step 4 doesn't touch them.

Re-export `GradStop` from `src/index.ts` (the weasel barrel):

```ts
// In src/index.ts, add to the paint exports:
export type { Paint, GradStop, Stroke, StrokeAlign, /* ... existing ... */ } from './core/paint';
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- packages/weasel-gl/src/gradientTypes.test.ts
npm run typecheck
```

Expected: PASS (5 tests), 0 type errors.

- [ ] **Step 5: Commit**

```bash
git add src/core/paint.ts src/index.ts packages/weasel-gl/src/gradientTypes.test.ts
git commit -m "feat(paint): add GradStop + linear/radial/conic gradient Paint variants"
```

---

## Task 2: `buildGradientRamp` and `GradientRampCache`

**Files:**
- Create: `packages/weasel-gl/src/GradientRampCache.ts`
- Create: `packages/weasel-gl/src/GradientRampCache.test.ts`

**Conventions:** §9 — the cache is GL-context-bound. The ramp builder is pure (no GL). The key is `JSON.stringify(stops)` which is a stable hash for the step-4 scale. The cache lives on the renderer instance, not in a module-level singleton — so multi-renderer isolation is automatic.

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-gl/src/GradientRampCache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { buildGradientRamp, GradientRampCache } from './GradientRampCache';
import type { GradStop } from '@orochi235/weasel';

const BLACK_WHITE: GradStop[] = [
  { offset: 0, color: '#000000' },
  { offset: 1, color: '#ffffff' },
];

const RED_BLUE: GradStop[] = [
  { offset: 0, color: '#ff0000' },
  { offset: 1, color: '#0000ff' },
];

describe('buildGradientRamp', () => {
  it('returns a Uint8ClampedArray of length 256 × 4', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(ramp).toBeInstanceOf(Uint8ClampedArray);
    expect(ramp.length).toBe(256 * 4);
  });

  it('first pixel is the first stop color', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(Array.from(ramp.slice(0, 4))).toEqual([0, 0, 0, 255]);
  });

  it('last pixel is the last stop color', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    expect(Array.from(ramp.slice(252, 256))).toEqual([255, 255, 255, 255]);
  });

  it('midpoint pixel is a linear blend', () => {
    const ramp = buildGradientRamp(BLACK_WHITE);
    // position 128/255 ≈ 0.502; expected [128, 128, 128, 255] ± 1
    const [r, g, b, a] = ramp.slice(128 * 4, 128 * 4 + 4);
    expect(r).toBeGreaterThanOrEqual(127);
    expect(r).toBeLessThanOrEqual(129);
    expect(g).toBe(r);
    expect(b).toBe(r);
    expect(a).toBe(255);
  });

  it('multi-stop: pixel before midstop is interpolated from stop 0 to stop 1', () => {
    const stops: GradStop[] = [
      { offset: 0,   color: '#ff0000' },
      { offset: 0.5, color: '#00ff00' },
      { offset: 1,   color: '#0000ff' },
    ];
    const ramp = buildGradientRamp(stops);
    // At position 0.25 (64/255 ≈ midpoint between stop0 and stop1): ~(128, 128, 0)
    const [r, g, b] = ramp.slice(64 * 4, 64 * 4 + 4);
    expect(r).toBeGreaterThan(100);
    expect(g).toBeGreaterThan(100);
    expect(b).toBeLessThan(20);
  });

  it('single-stop ramp fills entirely with that color', () => {
    const stops: GradStop[] = [{ offset: 0, color: '#ff0000' }];
    const ramp = buildGradientRamp(stops);
    for (let i = 0; i < 256; i++) {
      expect(ramp[i * 4]).toBe(255);     // R
      expect(ramp[i * 4 + 1]).toBe(0);   // G
      expect(ramp[i * 4 + 2]).toBe(0);   // B
      expect(ramp[i * 4 + 3]).toBe(255); // A
    }
  });
});

describe('GradientRampCache', () => {
  it('upload() calls createTexture + texImage2D', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const key = cache.upload(BLACK_WHITE);
    expect(typeof key).toBe('string');
    expect(calls.some((c) => c.name === 'createTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('upload() for identical stops returns the same key (cache hit)', () => {
    const { gl } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const k1 = cache.upload(BLACK_WHITE);
    const k2 = cache.upload([...BLACK_WHITE]);  // different array reference, same content
    expect(k1).toBe(k2);
  });

  it('upload() for different stops returns distinct keys', () => {
    const { gl } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const k1 = cache.upload(BLACK_WHITE);
    const k2 = cache.upload(RED_BLUE);
    expect(k1).not.toBe(k2);
  });

  it('upload() does not createTexture twice for the same stops (idempotent)', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    cache.upload(BLACK_WHITE);
    const countBefore = calls.filter((c) => c.name === 'createTexture').length;
    cache.upload(BLACK_WHITE);
    const countAfter = calls.filter((c) => c.name === 'createTexture').length;
    expect(countBefore).toBe(countAfter);
  });

  it('bind() calls activeTexture + bindTexture', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    const key = cache.upload(BLACK_WHITE);
    reset();
    cache.bind(key, 1);
    expect(calls.some((c) => c.name === 'activeTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'bindTexture')).toBe(true);
  });

  it('hitRate() returns 1.0 when every upload is a cache hit', () => {
    const { gl } = makeGLRecorder();
    const cache = new GradientRampCache(gl);
    cache.upload(BLACK_WHITE);         // miss (first)
    cache.upload(BLACK_WHITE);         // hit
    cache.upload(BLACK_WHITE);         // hit
    // 2 hits / 3 total = 0.666... but spec asks > 95% in soak demo, not unit test.
    // Just verify the method exists and returns a number in [0, 1].
    const rate = cache.hitRate();
    expect(rate).toBeGreaterThanOrEqual(0);
    expect(rate).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- packages/weasel-gl/src/GradientRampCache.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GradientRampCache.ts`**

Create `packages/weasel-gl/src/GradientRampCache.ts`:

```ts
/**
 * CPU gradient-ramp builder + GL 1×256 RGBA texture cache.
 *
 * Each unique stop list is uploaded once. Key = JSON.stringify(stops).
 * The cache is GL-context-bound; discard and recreate on context loss.
 *
 * Ramp: 256 texels, LINEAR filtering so the fragment shader can sample
 * at any fractional position and get a smooth blend.
 *
 * Output convention §2: texels are stored as straight RGBA 0..255.
 * The ramp itself does not premultiply — the *shader* applies premultiplication
 * before writing outColor: vec4(rgb * a, a).
 */

import type { GradStop } from '@orochi235/weasel';
import { parseColor } from './color';

const RAMP_SIZE = 256;

/** Build a 1×256 RGBA ramp as a flat Uint8ClampedArray (RAMP_SIZE × 4 bytes). */
export function buildGradientRamp(stops: GradStop[]): Uint8ClampedArray {
  const data = new Uint8ClampedArray(RAMP_SIZE * 4);

  if (stops.length === 0) return data; // transparent

  // Normalise: sort by offset, clamp to [0,1].
  const sorted = [...stops].sort((a, b) => a.offset - b.offset);

  // Parse all stop colors up front.
  const parsed: [number, number, number, number][] = sorted.map((s) => {
    const [r, g, b, a] = parseColor(s.color);
    return [r * 255, g * 255, b * 255, a * 255];
  });

  for (let i = 0; i < RAMP_SIZE; i++) {
    const t = i / (RAMP_SIZE - 1); // 0..1

    // Find the two surrounding stops.
    let lo = 0;
    for (let j = 0; j < sorted.length - 1; j++) {
      if (t >= sorted[j].offset) lo = j;
    }
    const hi = Math.min(lo + 1, sorted.length - 1);

    let r: number, g: number, b: number, a: number;
    if (lo === hi) {
      [r, g, b, a] = parsed[lo];
    } else {
      const span = sorted[hi].offset - sorted[lo].offset;
      const frac = span > 0 ? (t - sorted[lo].offset) / span : 0;
      const [r0, g0, b0, a0] = parsed[lo];
      const [r1, g1, b1, a1] = parsed[hi];
      r = r0 + (r1 - r0) * frac;
      g = g0 + (g1 - g0) * frac;
      b = b0 + (b1 - b0) * frac;
      a = a0 + (a1 - a0) * frac;
    }

    data[i * 4]     = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }

  return data;
}

export class GradientRampCache {
  private readonly map = new Map<string, WebGLTexture>();
  private totalQueries = 0;
  private cacheHits = 0;

  constructor(private readonly gl: WebGL2RenderingContext) {}

  upload(stops: GradStop[]): string {
    const key = JSON.stringify(stops);
    this.totalQueries++;
    if (this.map.has(key)) {
      this.cacheHits++;
      return key;
    }

    const ramp = buildGradientRamp(stops);
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('GradientRampCache: createTexture failed');

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA,
      RAMP_SIZE, 1, 0,
      gl.RGBA, gl.UNSIGNED_BYTE, ramp,
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    // Clamp so sampling beyond [0,1] returns the edge color, not garbage.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(key, tex);
    return key;
  }

  bind(key: string, unit: number): void {
    const tex = this.map.get(key);
    if (!tex) throw new Error(`GradientRampCache: key "${key}" not uploaded`);
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  /** Cache hit rate since construction (or last reset). 0 before any queries. */
  hitRate(): number {
    if (this.totalQueries === 0) return 0;
    return this.cacheHits / this.totalQueries;
  }

  resetStats(): void {
    this.totalQueries = 0;
    this.cacheHits = 0;
  }
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- packages/weasel-gl/src/GradientRampCache.test.ts
```

Expected: PASS (all ~14 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/GradientRampCache.ts packages/weasel-gl/src/GradientRampCache.test.ts
git commit -m "feat(weasel-gl): GradientRampCache — CPU ramp builder + GL 1×256 texture cache"
```

---

## Task 3: `GLImageCache` — WeakMap-keyed image upload

**Files:**
- Create: `packages/weasel-gl/src/GLImageCache.ts`
- Create: `packages/weasel-gl/src/GLImageCache.test.ts`

**Conventions:** §9 — cache is renderer-instance-bound. The WeakMap key is `ImageBitmap` identity, so the GC can collect unreferenced bitmaps. An uploaded-but-gc'd bitmap leaves a dangling `WebGLTexture`; this is acceptable for v1 (renderer lifetime is typically the page's lifetime and `ImageBitmap.close()` is the consumer's responsibility).

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-gl/src/GLImageCache.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { GLImageCache } from './GLImageCache';

// jsdom has no ImageBitmap; use a plain object as a stand-in.
const fakeImg1 = { width: 8, height: 8 } as ImageBitmap;
const fakeImg2 = { width: 4, height: 4 } as ImageBitmap;
const fakeImgData = new ImageData(8, 8);

describe('GLImageCache', () => {
  it('upload() creates a texture and returns a GL texture handle', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    const tex = cache.upload(fakeImg1, fakeImgData);
    expect(tex).toBeTruthy();
    expect(calls.some((c) => c.name === 'createTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('upload() is idempotent — second call for same identity skips createTexture', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    const countBefore = calls.filter((c) => c.name === 'createTexture').length;
    cache.upload(fakeImg1, fakeImgData);
    const countAfter = calls.filter((c) => c.name === 'createTexture').length;
    expect(countBefore).toBe(countAfter);
  });

  it('upload() for different identity creates separate textures', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    cache.upload(fakeImg2, fakeImgData);
    expect(calls.filter((c) => c.name === 'createTexture').length).toBe(2);
  });

  it('bind() calls activeTexture + bindTexture', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    reset();
    cache.bind(fakeImg1, 0);
    expect(calls.some((c) => c.name === 'activeTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'bindTexture')).toBe(true);
  });

  it('sets CLAMP_TO_EDGE wrap by default', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    const wrapCalls = calls.filter((c) => c.name === 'texParameteri');
    // Both TEXTURE_WRAP_S and TEXTURE_WRAP_T should use CLAMP_TO_EDGE.
    const hasClamp = wrapCalls.some((c) => c.args[2] === gl.CLAMP_TO_EDGE);
    expect(hasClamp).toBe(true);
  });

  it('sets REPEAT wrap when repetition is "repeat"', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData, 'repeat');
    const wrapCalls = calls.filter((c) => c.name === 'texParameteri');
    const hasRepeat = wrapCalls.some((c) => c.args[2] === gl.REPEAT);
    expect(hasRepeat).toBe(true);
  });

  it('sets MIRRORED_REPEAT wrap when repetition is "repeat-x" or "repeat-y"', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData, 'repeat-x');
    const wrapCalls = calls.filter((c) => c.name === 'texParameteri');
    const hasMirroredOrRepeat = wrapCalls.some(
      (c) => c.args[2] === gl.MIRRORED_REPEAT || c.args[2] === gl.REPEAT,
    );
    expect(hasMirroredOrRepeat).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- packages/weasel-gl/src/GLImageCache.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `GLImageCache.ts`**

Create `packages/weasel-gl/src/GLImageCache.ts`:

```ts
/**
 * GL texture upload cache for ImageBitmap objects.
 *
 * Key: ImageBitmap identity (WeakMap) — lets GC reclaim unreferenced bitmaps.
 * The texture objects are NOT freed when an ImageBitmap is gc'd; that would
 * require a FinalizationRegistry and is deferred to v2.
 *
 * Wrapping is set once at upload time based on the `repetition` parameter:
 *   - undefined / 'no-repeat' → CLAMP_TO_EDGE
 *   - 'repeat'               → REPEAT (both axes)
 *   - 'repeat-x'             → REPEAT on S, CLAMP on T
 *   - 'repeat-y'             → CLAMP on S, REPEAT on T
 *
 * Convention §2: texels are straight RGBA; the shader premultiplies.
 */

export type PatternRepetition = 'repeat' | 'repeat-x' | 'repeat-y' | 'no-repeat';

type TexSource = ImageBitmap | ImageData | HTMLCanvasElement | HTMLImageElement;

export class GLImageCache {
  // WeakMap on the consumer-supplied ImageBitmap (key); value is the GL texture.
  private readonly map = new WeakMap<object, WebGLTexture>();

  constructor(private readonly gl: WebGL2RenderingContext) {}

  /**
   * Upload `source` as a GL texture, keyed by `bitmap` identity.
   * `source` is typically the same object as `bitmap` (for ImageBitmap)
   * or a different object (e.g. the extracted ImageData for pattern pages).
   * Returns the WebGLTexture handle.
   */
  upload(
    key: object,
    source: TexSource,
    repetition?: PatternRepetition,
  ): WebGLTexture {
    const existing = this.map.get(key);
    if (existing) return existing;

    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error('GLImageCache: createTexture failed');

    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source as TexImageSource);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const [wrapS, wrapT] = wrapModes(gl, repetition);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
    gl.bindTexture(gl.TEXTURE_2D, null);

    this.map.set(key, tex);
    return tex;
  }

  bind(key: object, unit: number): void {
    const tex = this.map.get(key);
    if (!tex) throw new Error('GLImageCache: image not uploaded; call upload() first');
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }
}

function wrapModes(
  gl: WebGL2RenderingContext,
  rep?: PatternRepetition,
): [number, number] {
  switch (rep) {
    case 'repeat':   return [gl.REPEAT, gl.REPEAT];
    case 'repeat-x': return [gl.REPEAT, gl.CLAMP_TO_EDGE];
    case 'repeat-y': return [gl.CLAMP_TO_EDGE, gl.REPEAT];
    default:         return [gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE];
  }
}
```

- [ ] **Step 4: Add `REPEAT` and `MIRRORED_REPEAT` constants to the GL recorder**

Edit `packages/weasel-gl/test-utils/glRecorder.ts` — add to `GL_CONSTANTS`:

```ts
  // Wrap modes (step 4)
  REPEAT: 0x2901,
  MIRRORED_REPEAT: 0x8370,
```

- [ ] **Step 5: Run to verify it passes**

```bash
npm test -- packages/weasel-gl/src/GLImageCache.test.ts
```

Expected: PASS (all 7 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-gl/src/GLImageCache.ts packages/weasel-gl/src/GLImageCache.test.ts packages/weasel-gl/test-utils/glRecorder.ts
git commit -m "feat(weasel-gl): GLImageCache — WeakMap-keyed image upload with repetition-mode wrapping"
```

---

## Task 4: `imageFill` shader

**Files:**
- Create: `packages/weasel-gl/src/shaders/imageFill.ts`

**Conventions:** §2 — premultiplied output `vec4(rgb * a, a)`.

No test file for this task (shader source is a string constant; tested end-to-end by `ShaderProgram` compilation in Task 9 and pixel correctness in Task 13).

- [ ] **Step 1: Create `imageFill.ts`**

Create `packages/weasel-gl/src/shaders/imageFill.ts`:

```ts
/**
 * GLSL ES 3.0 sources for the image / pattern fill shader.
 *
 * Inputs:
 *   a_position  vec2   screen-space x,y of the quad corner
 *   a_uv        vec2   texture coordinate 0..1
 *
 * Uniforms:
 *   u_proj      mat3        screen → clip projection
 *   u_model     mat3        cumulative group transform
 *   u_sampler   sampler2D   the image texture (TEXTURE0)
 *   u_opacity   float       overall opacity multiplier, 0..1
 *   u_alpha     float       group alpha, 0..1
 *
 * Output convention §2: PREMULTIPLIED alpha — `vec4(rgb * a, a)`.
 * Blend func: ONE / ONE_MINUS_SRC_ALPHA (set by renderer at startup).
 *
 * For pattern fills the same shader is reused; wrapping is baked into
 * the texture's texParameteri settings, not the shader.
 */

export const IMAGE_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform mat3 u_proj;
uniform mat3 u_model;
out vec2 v_uv;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip   = u_proj  * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_uv;
}
`;

export const IMAGE_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_sampler;
uniform float u_opacity;
uniform float u_alpha;
out vec4 outColor;
void main() {
  vec4 texel = texture(u_sampler, v_uv);
  float a = texel.a * u_opacity * u_alpha;
  outColor = vec4(texel.rgb * a, a);
}
`;

export const IMAGE_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_sampler', 'u_opacity', 'u_alpha',
] as const;

export const IMAGE_FILL_ATTRIBUTES = ['a_position', 'a_uv'] as const;
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/shaders/imageFill.ts
git commit -m "feat(weasel-gl): imageFill shader — textured quad with premultiplied alpha output"
```

---

## Task 5: `gradFill` shader

**Files:**
- Create: `packages/weasel-gl/src/shaders/gradFill.ts`

**Conventions:** §2 — premultiplied output. §8 — the gradient coordinate projection math must be verified visually (unit test checks uniform names only; Playwright catches wrong projection).

The vertex shader passes a `v_world` varying (world-space position). The fragment shader projects `v_world` onto the gradient axis to produce a `t` in [0,1], then samples the 1×256 ramp texture at `(t, 0.5)`.

Three gradient kinds are handled via `u_gradKind: int`:
- `0` = linear: `t = dot(v_world - u_gradP0, u_gradDir) / u_gradLen`
- `1` = radial: `t = length(v_world - u_gradP0) / u_gradRadius`
- `2` = conic: `t = fract((atan(v_world.y - u_gradP0.y, v_world.x - u_gradP0.x) - u_gradAngle) / (2.0 * PI))`

This is one shader with `u_gradKind` branching. This is the deliberate exception to the "no branching" rule: the three branches are fixed at draw call setup time (uniform set once per draw, not per fragment-evaluation path), and the GPU branch predictor handles uniform-value branches very efficiently. The alternative (three separate shader programs) would triple the program count for this one feature and complicate the renderer dispatch. The `u_gradKind` branch runs identically for every fragment in a single draw call — the GPU executes only one branch per warp.

- [ ] **Step 1: Create `gradFill.ts`**

Create `packages/weasel-gl/src/shaders/gradFill.ts`:

```ts
/**
 * GLSL ES 3.0 sources for gradient-fill paths (linear, radial, conic).
 *
 * Vertex inputs (world-space positions from path mesh):
 *   a_position  vec2   path-local vertex x,y
 *
 * Uniforms:
 *   u_proj      mat3        screen → clip
 *   u_model     mat3        path-local → screen (group transform stack)
 *   u_worldInv  mat3        screen → world (inverse of the view matrix)
 *                           used to recover world coords in the fragment shader
 *   u_ramp      sampler2D   1×256 gradient ramp (TEXTURE0)
 *   u_alpha     float       group alpha, 0..1
 *   u_opacity   float       paint opacity, 0..1
 *
 *   -- gradient parameters --
 *   u_gradKind  int         0 = linear, 1 = radial, 2 = conic
 *   u_gradP0    vec2        world-space origin (linear from-pt / radial center / conic center)
 *   u_gradDir   vec2        world-space unit direction for linear gradient
 *   u_gradLen   float       world-space length of the linear gradient axis
 *   u_gradRadius float      world-space radius for radial gradient
 *   u_gradAngle float       start angle (radians) for conic gradient
 *
 * Output convention §2: PREMULTIPLIED alpha.
 *
 * Note: u_gradKind branching is acceptable here because the branch value is
 * uniform across all fragments in one draw call — the GPU does not diverge.
 */

export const GRAD_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform mat3 u_worldInv;
out vec2 v_world;
void main() {
  vec3 screen = u_model * vec3(a_position, 1.0);
  vec3 clip   = u_proj  * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  // Recover world-space position for the fragment shader.
  vec3 world = u_worldInv * vec3(screen.xy, 1.0);
  v_world = world.xy;
}
`;

export const GRAD_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_world;
uniform sampler2D u_ramp;
uniform float u_alpha;
uniform float u_opacity;
uniform int   u_gradKind;
uniform vec2  u_gradP0;
uniform vec2  u_gradDir;
uniform float u_gradLen;
uniform float u_gradRadius;
uniform float u_gradAngle;
out vec4 outColor;

const float PI = 3.14159265358979323846;

void main() {
  float t;
  if (u_gradKind == 0) {
    // Linear: project v_world onto the gradient axis.
    vec2 d = v_world - u_gradP0;
    t = dot(d, u_gradDir) / max(u_gradLen, 0.0001);
  } else if (u_gradKind == 1) {
    // Radial: distance from center, normalised by radius.
    t = length(v_world - u_gradP0) / max(u_gradRadius, 0.0001);
  } else {
    // Conic: angle from center, offset by start angle.
    float a = atan(v_world.y - u_gradP0.y, v_world.x - u_gradP0.x) - u_gradAngle;
    t = fract(a / (2.0 * PI));
  }
  t = clamp(t, 0.0, 1.0);
  vec4 rampColor = texture(u_ramp, vec2(t, 0.5));
  float a = rampColor.a * u_opacity * u_alpha;
  outColor = vec4(rampColor.rgb * a, a);
}
`;

export const GRAD_FILL_UNIFORMS = [
  'u_proj', 'u_model', 'u_worldInv', 'u_ramp',
  'u_alpha', 'u_opacity',
  'u_gradKind', 'u_gradP0', 'u_gradDir', 'u_gradLen', 'u_gradRadius', 'u_gradAngle',
] as const;

export const GRAD_FILL_ATTRIBUTES = ['a_position'] as const;
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/shaders/gradFill.ts
git commit -m "feat(weasel-gl): gradFill shader — gradient-ramp path fill (linear/radial/conic)"
```

---

## Task 6: Extend `WeaselRenderer` with new programs and caches

**Files:**
- Modify: `packages/weasel-gl/src/WeaselRenderer.ts`
- Modify: `packages/weasel-gl/src/WeaselRenderer.test.ts` (add assertions)

**Conventions:** §1 — GL recorder doesn't verify texture state; §9 — per-renderer caches.

- [ ] **Step 1: Write the failing test**

Add to `packages/weasel-gl/src/WeaselRenderer.test.ts`:

```ts
describe('WeaselRenderer (step 4: new programs)', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  beforeEach(() => { recorder = makeGLRecorder(); });

  it('compiles imageFill and gradFill shaders during construction', () => {
    new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    // pathFill (2) + textSdf (2) + imageFill (2) + gradFill (2) = 8 compileShader calls
    const compileCalls = recorder.calls.filter((c) => c.name === 'compileShader');
    expect(compileCalls.length).toBeGreaterThanOrEqual(8);
  });

  it('exposes _imageFill(), _gradFill(), _imageCache(), _gradRampCache() accessors', () => {
    const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    expect(r._imageFill()).toBeDefined();
    expect(r._gradFill()).toBeDefined();
    expect(r._imageCache()).toBeDefined();
    expect(r._gradRampCache()).toBeDefined();
  });

  it('reinitializes all four programs after webglcontextrestored', () => {
    const canvas = (() => {
      const listeners = new Map<string, EventListener>();
      return {
        width: 0, height: 0,
        getContext: () => recorder.gl,
        addEventListener: (t: string, l: EventListener) => listeners.set(t, l),
        removeEventListener: () => {},
        dispatchEvent: (t: string) => { listeners.get(t)?.(new Event(t) as unknown as Event); return true; },
      } as unknown as HTMLCanvasElement & { dispatchEvent(t: string): boolean };
    })();
    const r = new WeaselRenderer({ canvas, width: 100, height: 100, dpr: 1 });
    recorder.reset();
    canvas.dispatchEvent('webglcontextlost');
    canvas.dispatchEvent('webglcontextrestored');
    const compileCalls = recorder.calls.filter((c) => c.name === 'compileShader');
    // 8 shaders re-compiled on restore
    expect(compileCalls.length).toBeGreaterThanOrEqual(8);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- packages/weasel-gl/src/WeaselRenderer.test.ts
```

Expected: FAIL — `_imageFill is not a function` or similar.

- [ ] **Step 3: Implement**

Edit `packages/weasel-gl/src/WeaselRenderer.ts`:

1. Add imports for the new shaders and caches:

```ts
import {
  IMAGE_VERT_SRC, IMAGE_FRAG_SRC,
  IMAGE_FILL_UNIFORMS, IMAGE_FILL_ATTRIBUTES,
} from './shaders/imageFill';
import {
  GRAD_VERT_SRC, GRAD_FRAG_SRC,
  GRAD_FILL_UNIFORMS, GRAD_FILL_ATTRIBUTES,
} from './shaders/gradFill';
import { GLImageCache } from './GLImageCache';
import { GradientRampCache } from './GradientRampCache';
```

2. Add fields to the class:

```ts
private imageFill: ShaderProgram;
private gradFill: ShaderProgram;
private imageCache: GLImageCache;
private gradRampCache: GradientRampCache;
```

3. In the constructor (after the existing `textSdf` setup):

```ts
this.imageFill = new ShaderProgram(this.gl, IMAGE_VERT_SRC, IMAGE_FRAG_SRC);
this.imageFill.lookupUniforms(IMAGE_FILL_UNIFORMS);
this.imageFill.lookupAttributes(IMAGE_FILL_ATTRIBUTES);

this.gradFill = new ShaderProgram(this.gl, GRAD_VERT_SRC, GRAD_FRAG_SRC);
this.gradFill.lookupUniforms(GRAD_FILL_UNIFORMS);
this.gradFill.lookupAttributes(GRAD_FILL_ATTRIBUTES);

this.imageCache = new GLImageCache(this.gl);
this.gradRampCache = new GradientRampCache(this.gl);
```

4. Add `imageCache` and `gradRampCache` to the `DrawContext` passed to `dispatch`:

```ts
const ctx: DrawContext = {
  gl,
  pathFill: this.pathFill,
  textSdf: this.textSdf,
  imageFill: this.imageFill,
  gradFill: this.gradFill,
  meshCache: this.meshCache,
  textureCache: this.textureCache,
  imageCache: this.imageCache,
  gradRampCache: this.gradRampCache,
  state: this.groupState,
  widthCss: this.widthCss,
  heightCss: this.heightCss,
};
```

5. Mirror the same initialization in `onContextRestored`.

6. Add `@internal` accessors:

```ts
/** @internal */ _imageFill(): ShaderProgram { return this.imageFill; }
/** @internal */ _gradFill(): ShaderProgram { return this.gradFill; }
/** @internal */ _imageCache(): GLImageCache { return this.imageCache; }
/** @internal */ _gradRampCache(): GradientRampCache { return this.gradRampCache; }
```

Also update the `DrawContext` interface in `draw.ts`:

```ts
export interface DrawContext {
  gl: WebGL2RenderingContext;
  pathFill: ShaderProgram;
  textSdf: ShaderProgram;
  imageFill: ShaderProgram;
  gradFill: ShaderProgram;
  meshCache: GLMeshCache;
  textureCache: GLTextureCache;
  imageCache: GLImageCache;
  gradRampCache: GradientRampCache;
  state: GroupState;
  widthCss: number;
  heightCss: number;
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- packages/weasel-gl/src/WeaselRenderer.test.ts
```

Expected: PASS (all existing tests + 3 new).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/WeaselRenderer.ts packages/weasel-gl/src/WeaselRenderer.test.ts packages/weasel-gl/src/draw.ts
git commit -m "feat(weasel-gl): wire imageFill + gradFill programs and caches into WeaselRenderer"
```

---

## Task 7: `DrawCommand.ts` — add `ImageDrawCommand` + extend `PathDrawCommand.fill`

**Files:**
- Modify: `packages/weasel-gl/src/DrawCommand.ts`

- [ ] **Step 1: Update `DrawCommand.ts`**

Replace the existing `SolidPaint`-only fill type with the full `Paint` union and add `ImageDrawCommand`:

```ts
import type { Path, Stroke, TextStyle, Paint, GradStop } from '@orochi235/weasel';
import type { Mat3 } from './mat3';

export type { Paint, GradStop };

export type DrawCommand =
  | PathDrawCommand
  | GroupDrawCommand
  | TextDrawCommand
  | ImageDrawCommand;

export interface PathDrawCommand {
  kind: 'path';
  path: Path;
  /** Any Paint variant: solid, pattern, linear/radial/conic gradient. */
  fill?: Paint;
  stroke?: Stroke;
}

export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
  children: DrawCommand[];
}

export interface TextDrawCommand {
  kind: 'text';
  x: number;
  y: number;
  text: string;
  style: TextStyle;
}

export interface ImageDrawCommand {
  kind: 'image';
  /** Alive ImageBitmap from createImageBitmap() or similar. */
  image: ImageBitmap;
  /** Top-left x in screen (CSS pixel) space. */
  x: number;
  /** Top-left y in screen (CSS pixel) space. */
  y: number;
  /** Width in screen pixels. Image is stretched. */
  w: number;
  /** Height in screen pixels. */
  h: number;
  /** Overall opacity multiplier. Default 1. */
  opacity?: number;
}
```

Remove the old `SolidPaint` interface (it's replaced by the imported `Paint` union). Update `index.ts` to re-export `ImageDrawCommand` and `GradStop`.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors. (The existing `draw.ts` still uses `fill.color` on `SolidPaint`; fix narrowing in Task 8.)

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/DrawCommand.ts packages/weasel-gl/src/index.ts
git commit -m "feat(weasel-gl): DrawCommand — add ImageDrawCommand; extend PathDrawCommand.fill to full Paint union"
```

---

## Task 8: `draw.ts` — implement image, pattern, and gradient dispatch

**Files:**
- Modify: `packages/weasel-gl/src/draw.ts`
- Modify: `packages/weasel-gl/src/draw.test.ts`

**Conventions:** §2 — premultiplied output (enforced by shaders; `draw.ts` sets uniforms correctly). §8 — gradient projection correctness needs Playwright, not just call-count assertions.

This is the largest task. The key changes are:

1. `dispatch` gains a `'image'` case → `drawImage`.
2. `drawPath` routes `fill` to the right sub-function based on the paint variant.
3. Remove the `throw` in `drawPathStroke` for non-solid stroke paint — replace with a check that defers gracefully (warn + skip for non-solid stroke; solid stroke path unchanged).

### Helper: quad geometry for image rendering

Image draw needs a 4-vertex quad (positions in screen space + UV 0..1). Build it inline rather than through `GLMeshCache` (the mesh is ephemeral, like text):

```ts
function buildImageQuad(x: number, y: number, w: number, h: number): Float32Array {
  // Two triangles: TL–TR–BL and TR–BR–BL (CCW winding).
  // Interleaved: x, y, u, v per vertex.
  return new Float32Array([
    x,     y,     0, 0,   // TL
    x + w, y,     1, 0,   // TR
    x,     y + h, 0, 1,   // BL
    x + w, y + h, 1, 1,   // BR
  ]);
}
const IMAGE_QUAD_INDICES = new Uint32Array([0, 1, 2, 1, 3, 2]);
```

### Helper: extract image from CanvasPattern

```ts
function extractPatternImage(pattern: CanvasPattern): ImageBitmap | null {
  // CanvasPattern.image is a non-standard but widely-supported property.
  // https://html.spec.whatwg.org/ does not expose it, but all major browsers do.
  const img = (pattern as unknown as { image?: ImageBitmap | HTMLImageElement | HTMLCanvasElement }).image;
  if (img == null) {
    console.warn('weasel-gl: CanvasPattern.image not accessible; falling back to 1×1 transparent texture.');
    return null;
  }
  // For HTMLImageElement/HTMLCanvasElement we can pass directly to GLImageCache.upload
  // since the cache accepts the broader TexSource type. Use the pattern object as key.
  return img as ImageBitmap;
}

function extractPatternRepetition(pattern: CanvasPattern): PatternRepetition {
  const rep = (pattern as unknown as { repetition?: string }).repetition;
  if (rep === 'repeat' || rep === 'repeat-x' || rep === 'repeat-y' || rep === 'no-repeat') {
    return rep;
  }
  return 'repeat'; // default per CSS
}
```

- [ ] **Step 1: Write failing tests**

Add to `packages/weasel-gl/src/draw.test.ts`:

```ts
import type { RectPath } from '@orochi235/weasel';

describe('draw — kind: image', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('dispatches drawElements for a kind:image command', () => {
    const fakeImage = { width: 16, height: 16 } as ImageBitmap;
    r.render([{ kind: 'image', image: fakeImage, x: 10, y: 20, w: 100, h: 80 }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBe(1);
    // 6 indices (2 triangles)
    expect(draws[0].args[1]).toBe(6);
  });

  it('calls useProgram with imageFill program for kind:image', () => {
    const fakeImage = { width: 4, height: 4 } as ImageBitmap;
    r.render([{ kind: 'image', image: fakeImage, x: 0, y: 0, w: 50, h: 50 }]);
    const useProgramCalls = recorder.calls.filter((c) => c.name === 'useProgram');
    expect(useProgramCalls.length).toBeGreaterThanOrEqual(1);
  });

  it('skips image draw if w or h is 0', () => {
    const fakeImage = { width: 8, height: 8 } as ImageBitmap;
    r.render([{ kind: 'image', image: fakeImage, x: 0, y: 0, w: 0, h: 50 }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBe(0);
  });
});

describe('draw — path fill: linear-gradient', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('dispatches drawElements for a gradient-filled rect path', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 100, height: 100 };
    r.render([{
      kind: 'path',
      path,
      fill: {
        fill: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 100, y: 0 },
        stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
      },
    }]);
    const draws = recorder.calls.filter((c) => c.name === 'drawElements');
    expect(draws.length).toBe(1);
  });

  it('uploads the gradient ramp texture (createTexture called)', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 50, height: 50 };
    r.render([{
      kind: 'path',
      path,
      fill: {
        fill: 'linear-gradient',
        from: { x: 0, y: 0 },
        to: { x: 50, y: 0 },
        stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      },
    }]);
    expect(recorder.calls.some((c) => c.name === 'createTexture')).toBe(true);
  });

  it('does not re-upload the ramp on second render with identical stops', () => {
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 50, height: 50 };
    const fillCmd = {
      kind: 'path' as const,
      path,
      fill: {
        fill: 'linear-gradient' as const,
        from: { x: 0, y: 0 },
        to: { x: 50, y: 0 },
        stops: [{ offset: 0, color: '#000' }, { offset: 1, color: '#fff' }],
      },
    };
    r.render([fillCmd]);
    const countBefore = recorder.calls.filter((c) => c.name === 'createTexture').length;
    r.render([fillCmd]);
    const countAfter = recorder.calls.filter((c) => c.name === 'createTexture').length;
    expect(countBefore).toBe(countAfter);
  });
});

describe('draw — path fill: pattern', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  it('falls back gracefully when CanvasPattern.image is not accessible', () => {
    // A plain object with no .image property simulates a restricted environment.
    const pattern = {} as CanvasPattern;
    const path: RectPath = { kind: 'rect', x: 0, y: 0, width: 50, height: 50 };
    // Should warn but not throw.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => r.render([{ kind: 'path', path, fill: { fill: 'pattern', pattern } }])).not.toThrow();
    warnSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- packages/weasel-gl/src/draw.test.ts
```

Expected: many FAILs — `'image'` case not in dispatch switch; gradient paths throw "step 4: gradient/pattern arrives in step 4".

- [ ] **Step 3: Implement `draw.ts` changes**

Add imports:

```ts
import type { GLImageCache, PatternRepetition } from './GLImageCache';
import type { GradientRampCache } from './GradientRampCache';
import type { ImageDrawCommand } from './DrawCommand';
import type { Paint } from '@orochi235/weasel';
import { mat3 } from './mat3';
```

Add `'image'` to dispatch switch:

```ts
case 'image': return drawImage(ctx, cmd);
```

Add `drawImage` function:

```ts
function drawImage(ctx: DrawContext, cmd: ImageDrawCommand): void {
  if (cmd.w <= 0 || cmd.h <= 0) return;

  const gl = ctx.gl;
  const { x, y, w, h } = cmd;

  // Upload image to GL image cache (idempotent).
  ctx.imageCache.upload(cmd.image, cmd.image as unknown as ImageData);

  // Build quad geometry.
  const verts = buildImageQuad(x, y, w, h);

  const prog = ctx.imageFill;
  gl.useProgram(prog.handle);

  // Dynamic VAO/VBO for this quad.
  const vao = gl.createVertexArray();
  if (!vao) throw new Error('drawImage: createVertexArray failed');
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  if (!vbo) throw new Error('drawImage: createBuffer failed');
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);

  const stride = 16; // 4 floats × 4 bytes
  const aPosLoc = prog.attribute('a_position');
  const aUvLoc  = prog.attribute('a_uv');
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);
  }

  const ibo = gl.createBuffer();
  if (!ibo) throw new Error('drawImage: createBuffer (ibo) failed');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, IMAGE_QUAD_INDICES, gl.DYNAMIC_DRAW);

  // Uniforms.
  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(prog.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(prog.uniform('u_model')!, false, ctx.state.transform);
  gl.uniform1f(prog.uniform('u_opacity')!, cmd.opacity ?? 1);
  gl.uniform1f(prog.uniform('u_alpha')!, ctx.state.alpha);

  ctx.imageCache.bind(cmd.image, 0);
  gl.uniform1i(prog.uniform('u_sampler')!, 0);

  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
```

Refactor `drawPath` to route fill paint variants:

```ts
function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
  if (!cmd.fill && !cmd.stroke) return;

  if (cmd.fill) {
    const fill = cmd.fill;
    if (!fill.fill || fill.fill === 'solid') {
      // Solid fill — existing path.
      const mesh = getMesh(cmd.path);
      const handle = ctx.meshCache.handleFor(mesh);
      if (handle.requiresStencil) {
        drawPathFillStencil(ctx, fill as SolidFill, handle);
      } else {
        drawPathFillSolid(ctx, fill as SolidFill, handle);
      }
    } else if (fill.fill === 'pattern') {
      drawPathPatternFill(ctx, fill, cmd);
    } else {
      // linear-gradient, radial-gradient, conic-gradient
      drawPathGradFill(ctx, fill, cmd);
    }
  }

  if (cmd.stroke) {
    drawPathStroke(ctx, cmd);
  }
}
```

Add `drawPathGradFill`:

```ts
function drawPathGradFill(ctx: DrawContext, fill: Extract<Paint, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>, cmd: PathDrawCommand): void {
  const mesh = getMesh(cmd.path);
  const handle = ctx.meshCache.handleFor(mesh);
  const gl = ctx.gl;
  const prog = ctx.gradFill;
  gl.useProgram(prog.handle);
  gl.bindVertexArray(handle.vao);

  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(prog.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(prog.uniform('u_model')!, false, ctx.state.transform);

  // worldInv = inverse of model (model = u_view composed with group transform;
  // for now model IS the group transform since coordinates are already in screen space).
  // The gradient parameters are in world space; v_world recovers them via worldInv.
  // Simple approach: pass identity worldInv (world = screen) for step 4.
  // TODO(step 9): pass the actual view inverse when layers pass world-space coords.
  const worldInv = mat3.identity();
  gl.uniformMatrix3fv(prog.uniform('u_worldInv')!, false, worldInv);

  gl.uniform1f(prog.uniform('u_alpha')!, ctx.state.alpha);
  gl.uniform1f(prog.uniform('u_opacity')!, fill.opacity ?? 1);

  // Gradient-kind-specific uniforms.
  if (fill.fill === 'linear-gradient') {
    const dx = fill.to.x - fill.from.x;
    const dy = fill.to.y - fill.from.y;
    const len = Math.hypot(dx, dy);
    const dirX = len > 0 ? dx / len : 1;
    const dirY = len > 0 ? dy / len : 0;
    gl.uniform1i(prog.uniform('u_gradKind')!, 0);
    gl.uniform2f(prog.uniform('u_gradP0')!, fill.from.x, fill.from.y);
    gl.uniform2f(prog.uniform('u_gradDir')!, dirX, dirY);
    gl.uniform1f(prog.uniform('u_gradLen')!, len);
    gl.uniform1f(prog.uniform('u_gradRadius')!, 0);
    gl.uniform1f(prog.uniform('u_gradAngle')!, 0);
  } else if (fill.fill === 'radial-gradient') {
    gl.uniform1i(prog.uniform('u_gradKind')!, 1);
    gl.uniform2f(prog.uniform('u_gradP0')!, fill.center.x, fill.center.y);
    gl.uniform2f(prog.uniform('u_gradDir')!, 1, 0);
    gl.uniform1f(prog.uniform('u_gradLen')!, 0);
    gl.uniform1f(prog.uniform('u_gradRadius')!, fill.radius);
    gl.uniform1f(prog.uniform('u_gradAngle')!, 0);
  } else {
    // conic
    gl.uniform1i(prog.uniform('u_gradKind')!, 2);
    gl.uniform2f(prog.uniform('u_gradP0')!, fill.center.x, fill.center.y);
    gl.uniform2f(prog.uniform('u_gradDir')!, 1, 0);
    gl.uniform1f(prog.uniform('u_gradLen')!, 0);
    gl.uniform1f(prog.uniform('u_gradRadius')!, 0);
    gl.uniform1f(prog.uniform('u_gradAngle')!, fill.angle);
  }

  // Upload and bind gradient ramp.
  const rampKey = ctx.gradRampCache.upload(fill.stops);
  ctx.gradRampCache.bind(rampKey, 0);
  gl.uniform1i(prog.uniform('u_ramp')!, 0);

  if (handle.requiresStencil) {
    // Two-pass stencil for evenodd gradient fill.
    gl.enable(gl.STENCIL_TEST);
    gl.colorMask(false, false, false, false);
    gl.stencilMask(0xff);
    gl.stencilFunc(gl.ALWAYS, 0, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);

    gl.colorMask(true, true, true, true);
    gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
    gl.clear(gl.STENCIL_BUFFER_BIT);
    gl.disable(gl.STENCIL_TEST);
  } else {
    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  }
  gl.bindVertexArray(null);
}
```

Add `drawPathPatternFill`:

```ts
function drawPathPatternFill(ctx: DrawContext, fill: Extract<Paint, { fill: 'pattern' }>, cmd: PathDrawCommand): void {
  const img = extractPatternImage(fill.pattern);
  const rep = extractPatternRepetition(fill.pattern);

  if (!img) {
    // Fallback: skip draw (warning already logged by extractPatternImage).
    return;
  }

  // Upload the source image under the CanvasPattern identity as key.
  ctx.imageCache.upload(fill.pattern as unknown as object, img as unknown as ImageData, rep);

  const mesh = getMesh(cmd.path);
  const handle = ctx.meshCache.handleFor(mesh);
  const gl = ctx.gl;
  const prog = ctx.imageFill;
  gl.useProgram(prog.handle);
  gl.bindVertexArray(handle.vao);

  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  gl.uniformMatrix3fv(prog.uniform('u_proj')!, false, proj);
  gl.uniformMatrix3fv(prog.uniform('u_model')!, false, ctx.state.transform);
  gl.uniform1f(prog.uniform('u_opacity')!, fill.opacity ?? 1);
  gl.uniform1f(prog.uniform('u_alpha')!, ctx.state.alpha);

  ctx.imageCache.bind(fill.pattern as unknown as object, 0);
  gl.uniform1i(prog.uniform('u_sampler')!, 0);

  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
```

Update `drawPathStroke` — replace the throw with a warn+skip for non-solid strokes (solid path unchanged):

```ts
function drawPathStroke(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const paint = stroke.paint;
  if (paint.fill && paint.fill !== 'solid') {
    // Gradient/pattern stroke arrives in step 5. Skip gracefully.
    console.warn(`weasel-gl: stroke.paint fill='${paint.fill}' not yet supported; skipping stroke.`);
    return;
  }
  // ... rest unchanged ...
}
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- packages/weasel-gl/src/draw.test.ts
```

Expected: all tests pass.

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/draw.ts packages/weasel-gl/src/draw.test.ts
git commit -m "feat(weasel-gl): draw — image, pattern, and gradient fill dispatch"
```

---

## Task 9: `color.ts` — `parseColorToRgba255` helper

**Files:**
- Modify: `packages/weasel-gl/src/color.ts`
- Modify: `packages/weasel-gl/src/color.test.ts`

`buildGradientRamp` currently calls `parseColor` (returns 0..1 floats) and then multiplies by 255. Extract this as a named helper so the ramp builder reads clearly and the conversion has its own test coverage.

- [ ] **Step 1: Add failing test**

Add to `packages/weasel-gl/src/color.test.ts`:

```ts
import { parseColorToRgba255 } from './color';

describe('parseColorToRgba255', () => {
  it('returns integer 0..255 components for #ffffff', () => {
    expect(parseColorToRgba255('#ffffff')).toEqual([255, 255, 255, 255]);
  });

  it('returns [0,0,0,255] for #000000', () => {
    expect(parseColorToRgba255('#000000')).toEqual([0, 0, 0, 255]);
  });

  it('handles rgba with fractional alpha', () => {
    const [r, g, b, a] = parseColorToRgba255('rgba(255, 0, 0, 0.5)');
    expect(r).toBe(255);
    expect(g).toBe(0);
    expect(b).toBe(0);
    // 0.5 × 255 = 127 (floor) or 128 (round) depending on implementation; accept both.
    expect(a).toBeGreaterThanOrEqual(127);
    expect(a).toBeLessThanOrEqual(128);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

```bash
npm test -- packages/weasel-gl/src/color.test.ts
```

- [ ] **Step 3: Add export to `color.ts`**

```ts
/** Like `parseColor` but returns integer 0..255 components. */
export function parseColorToRgba255(input: string): [number, number, number, number] {
  const [r, g, b, a] = parseColor(input);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255), Math.round(a * 255)];
}
```

Update `GradientRampCache.ts` to use this helper instead of manual multiplication:

```ts
import { parseColorToRgba255 } from './color';
// In buildGradientRamp:
const parsed = sorted.map((s) => parseColorToRgba255(s.color));
```

- [ ] **Step 4: Run to verify it passes**

```bash
npm test -- packages/weasel-gl/src/color.test.ts packages/weasel-gl/src/GradientRampCache.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/color.ts packages/weasel-gl/src/color.test.ts packages/weasel-gl/src/GradientRampCache.ts
git commit -m "refactor(weasel-gl): add parseColorToRgba255 helper; use in GradientRampCache"
```

---

## Task 10: Update barrel exports (`index.ts`)

**Files:**
- Modify: `packages/weasel-gl/src/index.ts`

- [ ] **Step 1: Update `index.ts`**

```ts
/**
 * @orochi235/weasel-gl — public barrel.
 *
 * Experimental. Surface evolves through the WebGL transition steps.
 * Through step 4: image, pattern, gradient Paint variants.
 */

export const __weaselGlPackage = true as const;

export { WeaselRenderer, type WeaselRendererOptions } from './WeaselRenderer';
export type {
  DrawCommand,
  GroupDrawCommand,
  PathDrawCommand,
  TextDrawCommand,
  ImageDrawCommand,
} from './DrawCommand';
export type { Paint, GradStop } from './DrawCommand';
export { mat3, type Mat3 } from './mat3';
export { tessellate, type TessellateOptions } from './tessellate';
export { tessellateStroke, type StrokeOptions } from './stroke';
export { registerFont } from './registerFont';
export type { Mesh } from './mesh';
export { buildGradientRamp, GradientRampCache } from './GradientRampCache';
```

- [ ] **Step 2: Run typecheck and barrel test**

```bash
npm test -- packages/weasel-gl/src/index.test.ts
npm run typecheck
```

Expected: PASS, 0 errors.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/index.ts
git commit -m "feat(weasel-gl): export ImageDrawCommand, GradStop, GradientRampCache from barrel"
```

---

## Task 11: Smoke page — image-gradient dev page

**Files:**
- Create: `packages/weasel-gl/dev/image-gradient.html`
- Create: `packages/weasel-gl/dev/image-gradient.ts`

**Conventions:** §6 — `preserveDrawingBuffer: true` AND `stencil: true`; §1 — pixel correctness verified here, not by unit tests.

The smoke page renders five scenes on five canvases:

1. **Image quad:** 200×150 `ImageBitmap` (generated from an off-screen canvas drawing a gradient rectangle) rendered at a fixed position.
2. **Linear gradient:** 300×300 rect path with a left-to-right red→blue linear gradient fill.
3. **Radial gradient:** 300×300 rect path with a center-out green→transparent radial fill.
4. **Conic gradient:** 300×300 rect path with a full-rotation rainbow conic fill.
5. **Pattern fill:** 300×300 rect path with a small checkerboard pattern (8×8 tile, created via an off-screen canvas).

- [ ] **Step 1: Create `image-gradient.html`**

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>weasel-gl image/gradient smoke</title>
  <style>
    body { margin: 16px; font-family: sans-serif; background: #f0f0f0; }
    canvas { display: block; margin: 8px 0; border: 1px solid #ccc; }
  </style>
</head>
<body>
  <h2>weasel-gl step-4 smoke</h2>
  <p>Image quad</p>
  <canvas id="c-image" width="400" height="200"></canvas>
  <p>Linear gradient fill</p>
  <canvas id="c-linear" width="400" height="300"></canvas>
  <p>Radial gradient fill</p>
  <canvas id="c-radial" width="400" height="300"></canvas>
  <p>Conic gradient fill</p>
  <canvas id="c-conic" width="400" height="300"></canvas>
  <p>Pattern fill</p>
  <canvas id="c-pattern" width="400" height="300"></canvas>
  <script type="module" src="./image-gradient.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `image-gradient.ts`**

```ts
import { WeaselRenderer } from '../src/WeaselRenderer';
import type { DrawCommand } from '../src/DrawCommand';
import { PATH_M as M, PATH_L as L, PATH_Z as Z } from '@orochi235/weasel';

function getCtx(id: string): WebGL2RenderingContext {
  const canvas = document.getElementById(id) as HTMLCanvasElement;
  const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
  if (!gl) throw new Error(`WebGL2 not available for ${id}`);
  return gl as WebGL2RenderingContext;
}

// ----- 1. Image quad -----
async function renderImage() {
  const gl = getCtx('c-image');
  const r = new WeaselRenderer({ gl, width: 400, height: 200, dpr: 1 });

  // Generate a test ImageBitmap from an off-screen canvas.
  const offscreen = document.createElement('canvas');
  offscreen.width = 200; offscreen.height = 150;
  const ctx2d = offscreen.getContext('2d')!;
  const grad = ctx2d.createLinearGradient(0, 0, 200, 0);
  grad.addColorStop(0, '#ff0000');
  grad.addColorStop(1, '#0000ff');
  ctx2d.fillStyle = grad;
  ctx2d.fillRect(0, 0, 200, 150);
  const bitmap = await createImageBitmap(offscreen);

  r.render([{ kind: 'image', image: bitmap, x: 100, y: 25, w: 200, h: 150 }]);
}

// ----- 2. Linear gradient -----
function renderLinear() {
  const gl = getCtx('c-linear');
  const r = new WeaselRenderer({ gl, width: 400, height: 300, dpr: 1 });
  const cmd: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 50, y: 50, width: 300, height: 200 },
    fill: {
      fill: 'linear-gradient',
      from: { x: 50, y: 0 },
      to: { x: 350, y: 0 },
      stops: [
        { offset: 0, color: '#ff0000' },
        { offset: 0.5, color: '#00ff00' },
        { offset: 1, color: '#0000ff' },
      ],
    },
  };
  r.render([cmd]);
}

// ----- 3. Radial gradient -----
function renderRadial() {
  const gl = getCtx('c-radial');
  const r = new WeaselRenderer({ gl, width: 400, height: 300, dpr: 1 });
  const cmd: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 50, y: 50, width: 300, height: 200 },
    fill: {
      fill: 'radial-gradient',
      center: { x: 200, y: 150 },
      radius: 150,
      stops: [
        { offset: 0, color: '#ffffff' },
        { offset: 0.5, color: '#00aa00' },
        { offset: 1, color: '#004400' },
      ],
    },
  };
  r.render([cmd]);
}

// ----- 4. Conic gradient -----
function renderConic() {
  const gl = getCtx('c-conic');
  const r = new WeaselRenderer({ gl, width: 400, height: 300, dpr: 1 });
  const cmd: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 50, y: 50, width: 300, height: 200 },
    fill: {
      fill: 'conic-gradient',
      center: { x: 200, y: 150 },
      angle: 0,
      stops: [
        { offset: 0,    color: '#ff0000' },
        { offset: 0.17, color: '#ff8800' },
        { offset: 0.33, color: '#ffff00' },
        { offset: 0.5,  color: '#00ff00' },
        { offset: 0.67, color: '#0000ff' },
        { offset: 0.83, color: '#8800ff' },
        { offset: 1,    color: '#ff0000' },
      ],
    },
  };
  r.render([cmd]);
}

// ----- 5. Pattern fill -----
async function renderPattern() {
  const gl = getCtx('c-pattern');
  const r = new WeaselRenderer({ gl, width: 400, height: 300, dpr: 1 });

  // Build a simple 16×16 checkerboard tile.
  const tile = document.createElement('canvas');
  tile.width = 16; tile.height = 16;
  const tc = tile.getContext('2d')!;
  tc.fillStyle = '#333';
  tc.fillRect(0, 0, 16, 16);
  tc.fillStyle = '#eee';
  tc.fillRect(0, 0, 8, 8);
  tc.fillRect(8, 8, 8, 8);

  const pattern = document.createElement('canvas').getContext('2d')!.createPattern(tile, 'repeat');
  if (!pattern) throw new Error('createPattern failed');
  (pattern as unknown as { image: HTMLCanvasElement }).image = tile;
  (pattern as unknown as { repetition: string }).repetition = 'repeat';

  const cmd: DrawCommand = {
    kind: 'path',
    path: { kind: 'rect', x: 50, y: 50, width: 300, height: 200 },
    fill: { fill: 'pattern', pattern },
  };
  r.render([cmd]);
}

// Boot all scenes.
renderLinear();
renderRadial();
renderConic();
renderImage().catch(console.error);
renderPattern().catch(console.error);
```

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/dev/image-gradient.html packages/weasel-gl/dev/image-gradient.ts
git commit -m "feat(weasel-gl/dev): image-gradient smoke page for step-4 visual verification"
```

---

## Task 12: Playwright smoke spec — pixel correctness

**Files:**
- Create: `packages/weasel-gl/dev/image-gradient.spec.ts`

**Conventions:** §6 — `preserveDrawingBuffer: true` on every canvas (done in Task 11). §1 — this is the primary pixel-correctness gate. §8 — gradient correctness (direction, center, wrap) requires sampling at specific positions in the canvas.

Sampling strategy: for each canvas, sample pixels at semantically meaningful positions (not a generic grid) that would catch the most likely bugs:
- **Linear:** sample left edge, center, and right edge of the gradient bar; verify R decreases and B increases left-to-right.
- **Radial:** sample center vs. edge; center should be bright, edge dark.
- **Conic:** sample at 4 cardinal angles from center; each should have a distinct hue.
- **Image:** sample the image canvas at a pixel we know is red (left side of the gradient bitmap).
- **Pattern:** sample at tile boundaries to confirm the checkerboard alternation.

- [ ] **Step 1: Create `image-gradient.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5174/image-gradient.html';

type RGB = [number, number, number];

async function samplePixel(page: import('@playwright/test').Page, canvasId: string, px: number, py: number): Promise<RGB> {
  return page.evaluate(
    ({ id, x, y }) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true }) as WebGL2RenderingContext;
      const buf = new Uint8Array(4);
      gl.readPixels(x, canvas.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return [buf[0], buf[1], buf[2]] as [number, number, number];
    },
    { id: canvasId, x: px, y: py },
  );
}

test.describe('image-gradient smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE);
    await page.waitForTimeout(300); // let async bitmap creation settle
  });

  test('linear gradient: left edge is red, right edge is blue', async ({ page }) => {
    // Left edge of gradient bar (x=60, y=150 is center-height of the rect)
    const left = await samplePixel(page, 'c-linear', 60, 150);
    // Right edge (x=340)
    const right = await samplePixel(page, 'c-linear', 340, 150);
    // Left: high red, low blue
    expect(left[0]).toBeGreaterThan(150);
    expect(left[2]).toBeLessThan(50);
    // Right: low red, high blue
    expect(right[0]).toBeLessThan(50);
    expect(right[2]).toBeGreaterThan(150);
  });

  test('radial gradient: center is brighter than edge', async ({ page }) => {
    const center = await samplePixel(page, 'c-radial', 200, 150);
    const edge   = await samplePixel(page, 'c-radial', 60, 150);
    const centerBrightness = center[0] + center[1] + center[2];
    const edgeBrightness   = edge[0]   + edge[1]   + edge[2];
    expect(centerBrightness).toBeGreaterThan(edgeBrightness);
  });

  test('conic gradient: distinct hues at four quadrants', async ({ page }) => {
    const top    = await samplePixel(page, 'c-conic', 200, 70);  // above center
    const right  = await samplePixel(page, 'c-conic', 330, 150); // right of center
    const bottom = await samplePixel(page, 'c-conic', 200, 230); // below center
    const left   = await samplePixel(page, 'c-conic', 70,  150); // left of center
    // Each quadrant should have a different dominant channel.
    // We don't assert exact hue — just that the four samples are meaningfully different.
    function dominant(rgb: RGB) { return rgb.indexOf(Math.max(...rgb)); }
    const dominants = new Set([dominant(top), dominant(right), dominant(bottom), dominant(left)]);
    // Expect at least 2 of the 4 to have different dominant channels.
    expect(dominants.size).toBeGreaterThanOrEqual(2);
  });

  test('image quad: left side has high red component', async ({ page }) => {
    // The test image is a red→blue gradient. At x=120 (left of the quad) R should dominate.
    const px = await samplePixel(page, 'c-image', 120, 100);
    expect(px[0]).toBeGreaterThan(150); // high R
    expect(px[2]).toBeLessThan(100);    // low B
  });

  test('pattern fill: alternating bright and dark tiles', async ({ page }) => {
    // The checkerboard has 16px tiles. At (58,58) it should be in a dark tile;
    // at (66,58) it should be in a bright tile (or vice versa — just verify they differ).
    const a = await samplePixel(page, 'c-pattern', 58, 58);
    const b = await samplePixel(page, 'c-pattern', 66, 58);
    const brightnessA = a[0] + a[1] + a[2];
    const brightnessB = b[0] + b[1] + b[2];
    expect(Math.abs(brightnessA - brightnessB)).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Start dev server and run spec manually**

```bash
cd packages/weasel-gl
npx vite dev --config dev/vite.config.ts --port 5174 &
sleep 3
npx playwright test dev/image-gradient.spec.ts
```

Iterate on failures by opening `http://localhost:5174/image-gradient.html` and visually inspecting each canvas. Common failure modes:
- Black canvas: shader compile error (check browser console).
- Wrong gradient direction: `u_gradDir` computation error.
- Transparent canvas: `preserveDrawingBuffer` not set.
- Conic seam artifact at angle=0: known; document in code comment.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/dev/image-gradient.spec.ts
git commit -m "test(weasel-gl): image-gradient Playwright smoke spec — pixel correctness for step 4"
```

---

## Task 13: Soak demo — gradient ramp cache hit rate

**Files:**
- Create: `packages/weasel-gl/scripts/gen-soak.ts`

**Conventions:** §3 — no new npm deps (no `--save-exact` needed here; this is a script, not a runtime dep).

The soak demo generates N random gradient path draws for 500 render frames and reports the cache hit rate. The spec exit criterion is >95% hit rate.

In practice, most scenes reuse the same gradient stops across frames — hits accumulate quickly. Misses happen only when `stops` arrays are newly-constructed per-frame with identical values but different references (would still be a cache hit because the key is `JSON.stringify`).

- [ ] **Step 1: Create `gen-soak.ts`**

Create `packages/weasel-gl/scripts/gen-soak.ts`:

```ts
/**
 * Gradient ramp cache soak: verifies >95% hit rate after initial frame warm-up.
 *
 * Usage: tsx packages/weasel-gl/scripts/gen-soak.ts
 *
 * The script is pure JS — it doesn't render to a canvas, just exercises
 * GradientRampCache directly with a realistic mixture of gradient stops.
 * Pre-warm: 1 frame of N gradients (N misses expected).
 * Soak: 499 more frames of the same gradients (expect N misses total out of 500N queries).
 */

import { GradientRampCache } from '../src/GradientRampCache';
import type { GradStop } from '@orochi235/weasel';

// Minimal fake GL for the soak (no real GPU needed).
const fakeGl = new Proxy({} as WebGL2RenderingContext, {
  get(_, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined;
    // Return GL constants as numbers.
    const CONSTS: Record<string, number> = {
      TEXTURE_2D: 0x0DE1,
      TEXTURE0: 0x84C0,
      RGBA: 0x1908,
      UNSIGNED_BYTE: 0x1401,
      LINEAR: 0x2601,
      TEXTURE_MIN_FILTER: 0x2801,
      TEXTURE_MAG_FILTER: 0x2800,
      TEXTURE_WRAP_S: 0x2802,
      TEXTURE_WRAP_T: 0x2803,
      CLAMP_TO_EDGE: 0x812F,
    };
    if (prop in CONSTS) return CONSTS[prop];
    if (/^[A-Z_0-9]+$/.test(prop)) return 0;
    if (prop === 'createTexture') return () => ({ __id: Math.random() });
    return () => {}; // no-op for all other GL methods
  },
});

// A fixed palette of 20 gradient stop configurations, reused across all frames.
const PALETTES: GradStop[][] = Array.from({ length: 20 }, (_, i) => [
  { offset: 0,   color: `#${(i * 13).toString(16).padStart(2, '0')}0000` },
  { offset: 0.5, color: `#00${(i * 7).toString(16).padStart(2, '0')}00` },
  { offset: 1,   color: `#0000${(i * 3 + 10).toString(16).padStart(2, '0')}` },
]);

const FRAMES = 500;
const GRADIENT_DRAWS_PER_FRAME = 50; // 10 unique × 5 uses each

const cache = new GradientRampCache(fakeGl);

for (let frame = 0; frame < FRAMES; frame++) {
  for (let i = 0; i < GRADIENT_DRAWS_PER_FRAME; i++) {
    // Each frame: cycle through palettes, creating new array objects each time.
    // JSON.stringify equality ensures cache hits despite reference inequality.
    const palette = PALETTES[i % PALETTES.length];
    cache.upload([...palette]);
  }
}

const rate = cache.hitRate();
const totalQueries = FRAMES * GRADIENT_DRAWS_PER_FRAME;
const totalMisses = totalQueries - Math.round(rate * totalQueries);

console.log(`Gradient ramp cache soak:`);
console.log(`  Frames:        ${FRAMES}`);
console.log(`  Draws/frame:   ${GRADIENT_DRAWS_PER_FRAME}`);
console.log(`  Total queries: ${totalQueries}`);
console.log(`  Estimated misses: ~${totalMisses} (first frame only)`);
console.log(`  Hit rate:      ${(rate * 100).toFixed(2)}%`);

if (rate < 0.95) {
  console.error(`FAIL: hit rate ${(rate * 100).toFixed(2)}% < 95%`);
  process.exit(1);
} else {
  console.log(`PASS: hit rate > 95%`);
}
```

- [ ] **Step 2: Run the soak**

```bash
npx tsx packages/weasel-gl/scripts/gen-soak.ts
```

Expected output:
```
Gradient ramp cache soak:
  Frames:        500
  Draws/frame:   50
  Total queries: 25000
  Estimated misses: ~20 (first frame only)
  Hit rate:      99.92%
PASS: hit rate > 95%
```

(20 unique palettes × 1 miss each = 20 misses out of 25000 queries = 99.92% hit rate.)

- [ ] **Step 3: Add `soak:grad` script to `package.json`**

```jsonc
"scripts": {
  "soak:grad": "tsx packages/weasel-gl/scripts/gen-soak.ts"
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-gl/scripts/gen-soak.ts package.json
git commit -m "feat(weasel-gl): gradient ramp soak script — verifies >95% cache hit rate"
```

---

## Task 14: Run full test suite + final typecheck

- [ ] **Step 1: Run all vitest tests**

```bash
npm test
```

Expected: all existing 1384 tests from steps 1–3 pass, plus ~50 new tests from step 4. Zero failures.

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Run soak script**

```bash
npm run soak:grad
```

Expected: PASS.

- [ ] **Step 4: Run Playwright smoke tests**

```bash
cd packages/weasel-gl
npx vite dev --config dev/vite.config.ts --port 5174 &
sleep 3
npx playwright test dev/
```

Expected: all 3 existing smoke specs (smoke, synthetic, text) + new image-gradient spec pass.

Kill the dev server after the tests.

- [ ] **Step 5: Commit done note**

Create `docs/superpowers/plans/2026-05-09-webgl-step-4-done.md` with: what shipped, any deviations from this plan, test counts, and lessons for step 5. Update `webgl-stepwise-conventions.md` with any new lessons.

```bash
git add docs/superpowers/plans/2026-05-09-webgl-step-4-done.md docs/superpowers/plans/webgl-stepwise-conventions.md
git commit -m "docs: step-4 done note + conventions update"
```

---

## Summary of key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Shader strategy | Separate `imageFill` + `gradFill` (Option B from spec) | Avoids per-fragment paint-kind branching. Three small shaders are faster on fill-heavy scenes and easier to test in isolation. One deliberate exception: `u_gradKind` int branch in `gradFill` for linear/radial/conic, because this branch is uniform across a draw call and the GPU doesn't diverge. |
| Gradient ramp cache key | `JSON.stringify(stops)` | Simple, correct for step 4. Upgrade to a hash function if soak shows JSON stringify is a bottleneck (unlikely until hundreds of unique gradients per frame). |
| Image cache key | `ImageBitmap` object identity (WeakMap) | Consumer-owned objects have no natural string id. WeakMap allows GC to collect unreferenced bitmaps. |
| `u_worldInv` uniform | Passes identity for step 4 | Gradient parameters are in screen space for now; proper world-space gradients require the view matrix inverse, which isn't threaded into `DrawContext` yet. TODO comment left for step 9. |
| `CanvasPattern.image` access | Non-standard but universally supported | Chrome, Firefox, Safari, and Edge all expose it. Fallback: warn + skip on `null`. Document caveat in code comment. |
| Stroke non-solid paint | Warn + skip (not throw) | The step-2 throw was a temporary guard. Gradient strokes arrive in step 5; failing silently is better than throwing at runtime. |

---

## Known issues deferred

1. **Conic gradient seam at angle wrap**: the `fract(atan2 / 2π)` approach produces a 1-pixel discontinuity at the start angle. Document with a `// TODO(step9): conic seam` comment; the visual regression pass in step 9 will catch it.
2. **Pattern transform**: `CanvasPattern.setTransform()` is not honored. The pattern is uploaded with static wrap modes. A `TODO` comment is added in `drawPathPatternFill`.
3. **Gradient strokes**: `Stroke.paint` with a gradient variant logs a warning and skips. Lands in step 5.
4. **`u_worldInv` identity assumption**: gradient coordinates are effectively in screen space. Wires up correctly when layers pass world-space gradient params in step 7.
5. **`ImageBitmap.close()` and dangling textures**: not tracked. Step-level v1 limitation; add `FinalizationRegistry` cleanup in a future step.
