# WebGL Transition — Step 6: Minimal Experimental Shader API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `kind: 'shader'` DrawCommands reachable from consumer code by adding two public APIs — `registerProgram(id, vert, frag)` and `registerTexture(image)` — plus the dispatch path in `draw.ts`. A consumer can write a custom fragment shader, get back an opaque `ShaderProgramHandle`, and include it in a DrawCommand tree; the kit handles quad geometry, view/bounds uniforms, and uniform binding. Exits when a Voronoi fragment shader renders inside a bounded rect in headless Chromium with a mouse-position uniform updated each frame.

**Architecture (§A — registry and program compilation):** `kind: 'shader'` exists in the DrawCommand type union since step 1, but `ShaderProgramHandle` was unattainable from consumer code until now. The registry that maps program ids to compiled GL programs must live **on each `WeaselRenderer` instance**, not module-level, because GL programs are GL-context resources (the same reason `GLTextureCache` is per-renderer). This is the key architectural difference from `registerFont`, where the registry *is* module-level because font metrics and `ImageBitmap` data are GL-agnostic; only the texture upload binds to a context. Step 6's `registerProgram(id, vert, frag)` is called once at app startup against a specific renderer — the kit compiles the program immediately, throws `ShaderCompileError` synchronously on failure, and stores the compiled `ShaderProgram` in `WeaselRenderer.programRegistry: Map<string, ShaderProgram>`. `ShaderProgramHandle` is an opaque value object `{ readonly id: string }` — the renderer re-looks up the `ShaderProgram` by id at draw time.

**Architecture (§B — vertex prelude and uniform binding):** The kit's fixed vertex shader transforms the `bounds` rect into a full-quad covering that rect in screen space, then computes three varyings consumers can read in their fragment shaders: `v_uv` (0..1 across the quad), `v_screen` (pixel coords), and `v_world` (world coords via inverse-view). The consumer's fragment shader is concatenated after the kit provides the vertex shader; consumers see documented varyings + `u_bounds` + `u_view` plus any uniforms they declare in their fragment shader. The uniform binder is a `setUniform(gl, loc, value)` helper that dispatches on value type: bare number → `uniform1f`, two-element array → `uniform2fv`, three-element → `uniform3fv`, four-element → `uniform4fv`, `Float32Array` length 9 → `uniformMatrix3fv`, length 16 → `uniformMatrix4fv`, `TextureHandle` → bind texture to next available unit + `uniform1i`. **Convention §2 applies with full force here:** the consumer fragment shader MUST output premultiplied alpha. The kit documents this loudly in `registerProgram`'s JSDoc; the smoke test uses a fragment shader that outputs premultiplied output.

**Tech stack:** TypeScript (strict), vitest. No new npm dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`](../specs/2026-05-08-webgl-transition-plan-design.md), Sequencing → Step 6 and "Custom shader API (experimental v1)."

**Required reading before starting:**
- [`webgl-stepwise-conventions.md`](./webgl-stepwise-conventions.md) — accumulated lessons. §1, §2, §3, §6, §9 apply directly (see task callouts below).
- [`2026-05-09-webgl-step-3-done.md`](./2026-05-09-webgl-step-3-done.md) — most recent done note.
- `packages/weasel-gl/src/WeaselRenderer.ts` — where programRegistry and context-restore must be wired.
- `packages/weasel-gl/src/draw.ts` — where `dispatch` gains the `'shader'` case.
- `packages/weasel-gl/src/ShaderProgram.ts` — `ShaderCompileError` already exists and is the right throw type.
- `packages/weasel-gl/src/GLTextureCache.ts` — `registerTexture`'s uploads go here.

**Conventions cited by specific tasks below:**
- Task 2 (handles + registry): §9 — do not track per-renderer state on shared module entries; programRegistry lives on the renderer instance, not module-level.
- Task 3 (custom vertex prelude): §2 — kit cannot enforce premultiplied output, but must document it. The prelude comment must say so explicitly.
- Task 5 (`registerProgram`): §2 — JSDoc on `registerProgram` must warn consumers their fragment shaders must output premultiplied alpha.
- Task 8 (`setUniform` binder): §2 — type detection order matters; document it.
- Task 10 (dispatch in draw.ts): §1 — unit tests use mock GL recorder; pixel correctness requires Playwright smoke.
- Task 11 (`registerTexture`): §9 — `GLTextureCache.upload` already has idempotency; rely on that; do not add a per-handle uploaded flag.
- Task 13 (Playwright smoke): §6 — `preserveDrawingBuffer: true` + `stencil: true` on the dev page's `getContext` call; §8 — grid pixel sampling not diagonal.

---

## File structure

Files this plan creates or modifies in `packages/weasel-gl/`:

```
src/
  shaders/
    customPrelude.ts        # NEW — kit-supplied vertex shader GLSL + exports
  registerProgram.ts        # NEW — ShaderProgramHandle, ShaderUniform, ShaderCompileError re-export, registerProgram, warnOnce
  registerProgram.test.ts   # NEW
  registerTexture.ts        # NEW — TextureHandle, registerTexture
  registerTexture.test.ts   # NEW
  DrawCommand.ts            # MODIFY — add ShaderDrawCommand variant; import ShaderProgramHandle, TextureHandle, ShaderUniform
  draw.ts                   # MODIFY — drawShader() + dispatch 'shader' case; setUniform helper
  draw.test.ts              # MODIFY — assertions for shader draw calls
  WeaselRenderer.ts         # MODIFY — programRegistry: Map<string, ShaderProgram>; registerProgram(); registerTexture(); context-restore; expose in DrawContext
  index.ts                  # MODIFY — export registerProgram, registerTexture, ShaderProgramHandle, TextureHandle, ShaderUniform, ShaderDrawCommand, ShaderCompileError

dev/
  shader.html               # NEW — shader smoke page
  shader.ts                 # NEW — Voronoi fragment shader scene
  shader.spec.ts            # NEW — Playwright smoke spec
```

---

## Type definitions (reference for all tasks)

These types are the public surface. Tasks 1–3 implement them; later tasks depend on them.

```ts
// src/registerProgram.ts

/** Opaque handle to a compiled custom shader program. */
export interface ShaderProgramHandle {
  readonly id: string;
}

/**
 * Scalar and vector types accepted by the custom shader uniform binder.
 *
 * | TS type                 | GL call                              |
 * |-------------------------|--------------------------------------|
 * | number                  | uniform1f                            |
 * | [n, n]                  | uniform2fv                           |
 * | [n, n, n]               | uniform3fv                           |
 * | [n, n, n, n]            | uniform4fv                           |
 * | Float32Array length 9   | uniformMatrix3fv (column-major)      |
 * | Float32Array length 16  | uniformMatrix4fv (column-major)      |
 * | TextureHandle           | bind texture + uniform1i             |
 */
export type ShaderUniform =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Float32Array
  | TextureHandle;
```

```ts
// src/registerTexture.ts

/** Opaque handle to a texture uploaded via registerTexture(). */
export interface TextureHandle {
  readonly id: string;
}
```

```ts
// src/DrawCommand.ts — addition to existing union

/**
 * Custom shader draw command. The kit generates a quad over `bounds` and
 * dispatches the consumer's fragment shader with the kit's vertex prelude.
 *
 * `uniforms` keys must match names declared in the consumer's fragment shader.
 * The kit automatically sets u_bounds and u_view — do not declare those in uniforms.
 */
export interface ShaderDrawCommand {
  kind: 'shader';
  program: ShaderProgramHandle;
  uniforms: Record<string, ShaderUniform>;
  /** Screen-space bounding rect in CSS pixels. */
  bounds: { x: number; y: number; w: number; h: number };
}
```

---

## Vertex shader prelude (reference for Task 3)

The kit concatenates `CUSTOM_VERT_SRC` (below) with the consumer's fragment
shader at `registerProgram` call time. Consumers never touch the vertex shader.

```glsl
#version 300 es
// Kit-supplied vertex shader for kind:'shader' draw commands.
// Auto-generated quad covers the `bounds` rect in screen space.
//
// Varyings exposed to the consumer's fragment shader:
//   v_uv       — 0..1 across the bounds rect (0,0 top-left; 1,1 bottom-right)
//   v_screen   — screen-space pixel coordinate of this fragment
//   v_world    — world-space coordinate via inverse view transform
//
// Kit-managed uniforms (do NOT redeclare in your fragment shader):
//   u_bounds   — vec4(x, y, w, h) in screen-space CSS pixels
//   u_view     — mat3 weasel View matrix (world→screen)
//
// IMPORTANT: The canvas uses premultipliedAlpha:true (browser default).
// Your fragment shader MUST output premultiplied alpha:
//   outColor = vec4(rgb * a, a)  — NOT vec4(rgb, a)
// Failure produces over-bright translucent regions when composited over
// the page background. See conventions §2 in webgl-stepwise-conventions.md.

in vec2 a_position;  // -1..1 NDC quad fed by the kit
in vec2 a_uv;        // 0..1 quad UV, top-left to bottom-right

uniform vec4 u_bounds; // x, y, w, h in screen-space CSS pixels
uniform mat3 u_view;   // weasel View matrix (world→screen)

out vec2 v_uv;
out vec2 v_screen;
out vec2 v_world;

void main() {
  // Map NDC quad (-1..1) to screen-space pixel rect.
  // a_position.x == -1 → bounds.x,  a_position.x == 1 → bounds.x + bounds.z
  // a_position.y == -1 → bounds.y,  a_position.y == 1 → bounds.y + bounds.w
  float sx = u_bounds.x + (a_position.x * 0.5 + 0.5) * u_bounds.z;
  float sy = u_bounds.y + (a_position.y * 0.5 + 0.5) * u_bounds.w;
  v_screen = vec2(sx, sy);
  v_uv     = a_uv;

  // Approximate world coords: invert the affine 2×3 portion of u_view.
  // u_view maps world→screen; the [0..2][0..2] mat3 layout is column-major.
  // For the prelude we provide a best-effort approximate inverse; consumers
  // that need exact world coords should pass their own uniforms.
  // u_view columns: [m00, m10, 0], [m01, m11, 0], [tx, ty, 1]  (column-major)
  float det = u_view[0][0] * u_view[1][1] - u_view[0][1] * u_view[1][0];
  float invDet = det != 0.0 ? 1.0 / det : 1.0;
  float wx = ((sx - u_view[2][0]) * u_view[1][1] - (sy - u_view[2][1]) * u_view[0][1]) * invDet;
  float wy = ((sy - u_view[2][1]) * u_view[0][0] - (sx - u_view[2][0]) * u_view[1][0]) * invDet;
  v_world = vec2(wx, wy);

  // Map screen → clip: (sx / widthCss * 2 - 1, 1 - sy / heightCss * 2)
  // The renderer supplies these as part of u_bounds; we need canvas dims.
  // To avoid an additional uniform, we compute clip from a_position directly:
  // a_position is already -1..1 in the auto-quad, but we need it in clip-space
  // relative to the canvas, not just the bounds.
  // Use the proj transform supplied by the renderer via u_proj (mat3).
  // The consumer-facing contract is varyings + u_bounds only; u_proj is internal.
}
```

> **Implementation note for Task 3:** The vertex shader above uses a `u_proj` mat3 (screen→clip) identical to the path-fill shader's projection. The full vertex shader implementation in `customPrelude.ts` must use the same `mat3.screenToClip` projection that `draw.ts` already applies for path-fill. The varyings contract is public; the `u_proj` detail is internal. The final GLSL in `customPrelude.ts` should include `u_proj` (set by the renderer, not documented in the public consumer contract) and use it for `gl_Position`.

---

## Task 1: Add `ShaderDrawCommand` to `DrawCommand.ts`

**Files:** `src/DrawCommand.ts`

No new imports needed yet (ShaderProgramHandle and TextureHandle are imported from files created in Task 2 and Task 5; do this in the same commit as those).

> This task is noted here for sequencing; it is bundled into the Task 2 / Task 5 commits below. Skip standalone.

---

## Task 2: Define `TextureHandle` and `registerTexture`

**Files:**
- Create: `src/registerTexture.ts`
- Create: `src/registerTexture.test.ts`

This is the simpler of the two registration APIs. `registerTexture` takes an image, assigns an auto-generated id, and **does not upload to GL at call time** — GL context is not available here. Actual upload happens lazily at draw time, exactly as font atlases work, using `GLTextureCache.upload` (which is already idempotent per convention §9).

> Convention §9: the TextureRegistry is module-level (stores image data), but per-renderer texture state lives in each renderer's `GLTextureCache`. Do not add an `uploaded` flag here.

- [ ] **Step 1: Create `src/registerTexture.ts`**

```ts
/**
 * registerTexture — accepts an image source, assigns an opaque id, stores in
 * a module-level registry. Actual GL upload happens lazily at draw time in
 * drawShader() via GLTextureCache.upload (which is idempotent).
 *
 * Lifecycle: textures live for the renderer's lifetime. No unregister in v1.
 *
 * Convention §9: this registry stores image data only — no per-renderer state.
 * Each WeaselRenderer's GLTextureCache does its own dedup via has(id).
 */

export interface TextureHandle {
  readonly id: string;
}

export interface TextureEntry {
  source: HTMLImageElement | ImageBitmap;
}

let counter = 0;
let registry = new Map<string, TextureEntry>();

/** @internal Test helper — do not call from product code. */
export function _resetTextureRegistryForTests(): void {
  registry = new Map();
  counter = 0;
}

export function getTexture(id: string): TextureEntry | null {
  return registry.get(id) ?? null;
}

/**
 * Register an image for use as a shader texture uniform.
 *
 * Returns a TextureHandle whose `id` can be passed as a ShaderUniform value.
 * The handle is valid for the lifetime of the renderer it will be used with.
 *
 * @param image  The image to register. HTMLImageElement must be fully loaded.
 * @returns      Opaque TextureHandle.
 */
export function registerTexture(
  image: HTMLImageElement | ImageBitmap,
): TextureHandle {
  const id = `tex_${++counter}`;
  registry.set(id, { source: image });
  return { id };
}
```

- [ ] **Step 2: Create `src/registerTexture.test.ts`**

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerTexture,
  getTexture,
  _resetTextureRegistryForTests,
} from './registerTexture';

// Minimal stub that satisfies HTMLImageElement for registry storage.
function makeImageStub(): HTMLImageElement {
  return { src: 'test.png', width: 4, height: 4 } as unknown as HTMLImageElement;
}

describe('registerTexture', () => {
  beforeEach(() => _resetTextureRegistryForTests());

  it('returns a handle with a non-empty id', () => {
    const img = makeImageStub();
    const h = registerTexture(img);
    expect(h.id).toBeTruthy();
  });

  it('returns distinct handles for separate registrations', () => {
    const a = registerTexture(makeImageStub());
    const b = registerTexture(makeImageStub());
    expect(a.id).not.toBe(b.id);
  });

  it('getTexture returns the registered source', () => {
    const img = makeImageStub();
    const h = registerTexture(img);
    const entry = getTexture(h.id);
    expect(entry?.source).toBe(img);
  });

  it('getTexture returns null for an unknown id', () => {
    expect(getTexture('nonexistent')).toBeNull();
  });

  it('ids are stable — same handle object as returned', () => {
    const h = registerTexture(makeImageStub());
    expect(getTexture(h.id)).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter weasel-gl test --run registerTexture
```

Expected: 5/5 pass.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/src/registerTexture.ts packages/weasel-gl/src/registerTexture.test.ts
git commit -m "feat(weasel-gl): add TextureHandle + registerTexture registry"
```

---

## Task 3: Add custom vertex prelude (`shaders/customPrelude.ts`)

**Files:**
- Create: `src/shaders/customPrelude.ts`

This module exports the kit-supplied vertex shader source that is prepended to every consumer program. It also exports the quad geometry data (4 vertices, 6 indices) that the renderer uploads once and reuses for all `kind: 'shader'` draws.

> Convention §2: the premultiplied-alpha warning is the most important thing in this file. It appears in the vertex shader source comment AND as a JSDoc on `CUSTOM_VERT_SRC`. Every consumer fragment shader that writes translucent pixels must output `vec4(rgb * a, a)`.

- [ ] **Step 1: Create `src/shaders/customPrelude.ts`**

```ts
/**
 * Kit-supplied vertex shader for kind:'shader' DrawCommands.
 *
 * Consumers write only fragment shaders. The vertex shader is fixed:
 * it generates a quad covering the DrawCommand's `bounds` rect and
 * exposes three varyings the fragment shader can consume.
 *
 * PUBLIC CONTRACT (varyings and kit uniforms):
 *
 *   in vec2  a_position   -1..1 NDC quad (set by the kit)
 *   in vec2  a_uv         0..1 across the bounds rect
 *
 *   uniform vec4 u_bounds  x, y, w, h in screen-space CSS pixels (set by kit)
 *   uniform mat3 u_view    weasel View matrix, world→screen (set by kit)
 *   uniform mat3 u_proj    screen→clip projection (internal, not documented)
 *
 *   out vec2 v_uv          0..1 across the bounds rect (top-left origin)
 *   out vec2 v_screen      screen-space pixel coordinate of this fragment
 *   out vec2 v_world       approximate world-space coordinate (via view inverse)
 *
 * PREMULTIPLIED ALPHA REQUIREMENT (conventions §2):
 * The canvas uses premultipliedAlpha:true (the WebGL2 default). Consumer
 * fragment shaders MUST output premultiplied alpha:
 *
 *   outColor = vec4(rgb * a, a);   // CORRECT
 *   outColor = vec4(rgb, a);       // WRONG — over-brightens translucent pixels
 *
 * The renderer uses gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA) to match.
 */

/**
 * Kit-supplied vertex shader source for custom programs.
 *
 * @remarks
 * **PREMULTIPLIED ALPHA:** Your fragment shader MUST output `vec4(rgb * a, a)`,
 * not `vec4(rgb, a)`. The canvas is composited with premultipliedAlpha:true;
 * straight-alpha output causes over-bright rendering for any fragment with a < 1.
 */
export const CUSTOM_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
uniform vec4 u_bounds;
uniform mat3 u_view;
uniform mat3 u_proj;
out vec2 v_uv;
out vec2 v_screen;
out vec2 v_world;

void main() {
  // Map a_uv (0..1) to screen space. a_uv.x=0 → x=bounds.x, a_uv.x=1 → x=bounds.x+bounds.z
  float sx = u_bounds.x + a_uv.x * u_bounds.z;
  float sy = u_bounds.y + a_uv.y * u_bounds.w;
  v_screen = vec2(sx, sy);
  v_uv = a_uv;

  // World coords: invert the affine 2×3 portion of u_view (world→screen).
  // u_view is column-major mat3: cols = [m00,m10,0], [m01,m11,0], [tx,ty,1]
  float det = u_view[0][0] * u_view[1][1] - u_view[0][1] * u_view[1][0];
  float invDet = det != 0.0 ? 1.0 / det : 1.0;
  v_world = vec2(
    ((sx - u_view[2][0]) *  u_view[1][1] + (sy - u_view[2][1]) * -u_view[0][1]) * invDet,
    ((sx - u_view[2][0]) * -u_view[1][0] + (sy - u_view[2][1]) *  u_view[0][0]) * invDet
  );

  // Screen → clip via kit projection.
  vec3 clip = u_proj * vec3(sx, sy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
}
`;

/**
 * Attribute names used by the custom vertex shader.
 * The renderer looks these up after compile.
 */
export const CUSTOM_ATTRIBUTES = ['a_position', 'a_uv'] as const;

/**
 * Kit-managed uniform names for custom shader programs.
 * These are set per-draw by drawShader(); consumers must NOT redeclare them.
 */
export const CUSTOM_KIT_UNIFORMS = ['u_bounds', 'u_view', 'u_proj'] as const;

/**
 * Auto-quad geometry: 4 vertices covering NDC (-1..1) and UV (0..1).
 *
 * Layout per vertex: [a_position.x, a_position.y, a_uv.x, a_uv.y]
 * (4 floats × 4 bytes = 16-byte stride, matching the text shader layout)
 *
 * Vertex order:
 *   0: top-left    (-1, -1, 0, 0)   ← Note: GL y-up, so -1 = top in NDC
 *   1: top-right   ( 1, -1, 1, 0)
 *   2: bottom-right( 1,  1, 1, 1)
 *   3: bottom-left (-1,  1, 0, 1)
 *
 * Wait — screen-space y is +down. The bounds rect has y=top.
 * a_uv.y=0 must correspond to bounds.y (top), a_uv.y=1 to bounds.y+bounds.w (bottom).
 * Map: a_position.y=-1 → a_uv.y=0 (top), a_position.y=1 → a_uv.y=1 (bottom).
 * In the vertex shader: sy = bounds.y + a_uv.y * bounds.w — correct.
 *
 * Indices: two triangles, CCW winding.
 *   tri 0: 0,1,2   tri 1: 0,2,3
 */
export const QUAD_VERTICES = new Float32Array([
  -1, -1,  0, 0,  // 0 top-left
   1, -1,  1, 0,  // 1 top-right
   1,  1,  1, 1,  // 2 bottom-right
  -1,  1,  0, 1,  // 3 bottom-left
]);

export const QUAD_INDICES = new Uint16Array([0, 1, 2, 0, 2, 3]);
```

> **Note on y-axis convention:** Screen space has y increasing downward; NDC has y increasing upward. The vertex shader uses `u_proj` (the same `mat3.screenToClip` used everywhere) to convert screen coords to clip space. The UV mapping `sy = bounds.y + a_uv.y * bounds.w` is screen-space (y-down), so `v_uv.y=0` is the top edge and `v_uv.y=1` is the bottom edge. This matches consumer intuition.

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/shaders/customPrelude.ts
git commit -m "feat(weasel-gl): add custom shader vertex prelude + quad geometry"
```

---

## Task 4: Update `DrawCommand.ts` with `ShaderDrawCommand`

**Files:** `src/DrawCommand.ts`

- [ ] **Step 1: Add imports and `ShaderDrawCommand` to `DrawCommand.ts`**

Add to the top imports (after existing imports):

```ts
import type { ShaderProgramHandle, ShaderUniform } from './registerProgram';
```

Add to the union type:

```ts
export type DrawCommand = PathDrawCommand | GroupDrawCommand | TextDrawCommand | ShaderDrawCommand;
```

Add interface:

```ts
/**
 * Custom shader draw command. The renderer generates a quad over `bounds`
 * and dispatches the consumer's fragment shader with the kit's vertex prelude.
 *
 * `uniforms` values are bound in the order they appear. The kit automatically
 * sets u_bounds, u_view, and u_proj — do not include those in uniforms.
 *
 * @experimental API may change before v2. See docs/superpowers/specs/ for
 * the v2 custom shader spec (consumer geometry, multi-pass, time uniforms).
 */
export interface ShaderDrawCommand {
  kind: 'shader';
  program: ShaderProgramHandle;
  uniforms: Record<string, ShaderUniform>;
  /** Screen-space bounding rect in CSS pixels. */
  bounds: { x: number; y: number; w: number; h: number };
}
```

Note: `ShaderUniform` imports `TextureHandle` transitively (it's part of the `ShaderUniform` union). Export `TextureHandle` from `index.ts` separately (Task 14).

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

Expected: errors only if `registerProgram.ts` doesn't exist yet — that is resolved in Task 5.

- [ ] **Step 3: Commit** (after Task 5, bundle this with that commit)

---

## Task 5: `registerProgram.ts` — program registry, `ShaderCompileError` re-export, `warnOnce`

**Files:**
- Create: `src/registerProgram.ts`
- Create: `src/registerProgram.test.ts`

`registerProgram` does **not** store compiled GL programs. It stores the raw `vert` and `frag` source strings, because compilation requires a GL context. The compiled `ShaderProgram` lives on the renderer (see Task 6). What `registerProgram` does:
1. Validates the call (rejects duplicates in prod; replaces in dev).
2. Stores the source in a module-level `ProgramSource` registry keyed by id.
3. Returns a `ShaderProgramHandle { id }`.

Compilation and `ShaderCompileError` throwing happen in `WeaselRenderer.registerProgram()` (Task 6), which calls this module to look up sources.

> Convention §9: the module-level registry stores **source strings only**, not compiled GL resources. This is the analog of `registerFont` storing `ImageBitmap` rather than `WebGLTexture`.

> Convention §2: the `registerProgram` JSDoc must warn about premultiplied alpha. This is the loudest place to document it for consumers.

- [ ] **Step 1: Create `src/registerProgram.ts`**

```ts
/**
 * registerProgram — public API for registering custom shader programs.
 *
 * Stores raw GLSL source strings in a module-level registry. GL compilation
 * happens on each WeaselRenderer via WeaselRenderer.registerProgram(), which
 * calls getProgramSource() and compiles the result. This keeps registerProgram
 * GL-context-agnostic — identical pattern to registerFont storing ImageBitmap.
 *
 * Convention §9: module-level state = source strings only; compiled GL
 * programs live on each renderer's programRegistry (Map<id, ShaderProgram>).
 *
 * Lifecycle: program sources live for the module lifetime. No unregister in v1.
 */

import { type TextureHandle } from './registerTexture';

export type { TextureHandle };

/** Opaque handle to a compiled custom shader program. */
export interface ShaderProgramHandle {
  readonly id: string;
}

/**
 * Scalar and vector uniform types accepted by the custom shader uniform binder.
 *
 * | TS type                 | GL call                              |
 * |-------------------------|--------------------------------------|
 * | number                  | uniform1f                            |
 * | [n, n]                  | uniform2fv                           |
 * | [n, n, n]               | uniform3fv                           |
 * | [n, n, n, n]            | uniform4fv                           |
 * | Float32Array length 9   | uniformMatrix3fv (column-major)      |
 * | Float32Array length 16  | uniformMatrix4fv (column-major)      |
 * | TextureHandle           | bind to next tex unit + uniform1i    |
 */
export type ShaderUniform =
  | number
  | [number, number]
  | [number, number, number]
  | [number, number, number, number]
  | Float32Array
  | TextureHandle;

export interface ProgramSource {
  vert: string;
  frag: string;
}

let registry = new Map<string, ProgramSource>();

/** @internal Test helper — do not call from product code. */
export function _resetProgramRegistryForTests(): void {
  registry = new Map();
}

export function getProgramSource(id: string): ProgramSource | null {
  return registry.get(id) ?? null;
}

const isDev = typeof process !== 'undefined'
  ? process.env.NODE_ENV !== 'production'
  : true;

/**
 * Register a custom shader program by id.
 *
 * Pass an empty string for `vert` to use the kit's default vertex shader
 * (recommended). The kit's vertex shader exposes `v_uv`, `v_screen`, and
 * `v_world` varyings plus `u_bounds` and `u_view` uniforms.
 *
 * **IMPORTANT — Premultiplied alpha (conventions §2):**
 * Your fragment shader MUST output premultiplied alpha:
 *   `outColor = vec4(rgb * a, a);`  ← correct
 *   `outColor = vec4(rgb, a);`      ← WRONG — over-brightens translucent regions
 *
 * The renderer uses `gl.blendFunc(ONE, ONE_MINUS_SRC_ALPHA)` to match.
 * Opaque fragments (a=1) are unaffected; only fragments with a < 1 differ.
 *
 * **Re-registration behavior:**
 * - Dev mode (`NODE_ENV !== 'production'`): calling with an existing id replaces
 *   the source (hot-reload). Each renderer must call `WeaselRenderer.recompileProgram(id)`
 *   to pick up the new source.
 * - Prod mode: calling with an existing id throws `Error('duplicate program id: …')`.
 *
 * Actual GL compilation and `ShaderCompileError` throwing happen in
 * `WeaselRenderer.registerProgram()`, not here.
 *
 * @experimental API may break before v2.
 *
 * @param id    Unique string key for this program. Used by ShaderProgramHandle.
 * @param vert  Vertex shader source. Pass `''` to use the kit's default prelude.
 * @param frag  Fragment shader source. Must include `#version 300 es` and `out vec4 outColor`.
 * @returns     Opaque ShaderProgramHandle.
 * @throws      Error if id is already registered in prod mode.
 */
export function registerProgram(
  id: string,
  vert: string,
  frag: string,
): ShaderProgramHandle {
  if (registry.has(id) && !isDev) {
    throw new Error(`weasel-gl registerProgram: duplicate program id "${id}". ` +
      `In production, re-registration is not allowed. Pass a unique id or call in dev mode.`);
  }
  registry.set(id, { vert, frag });
  return { id };
}
```

- [ ] **Step 2: Create `src/registerProgram.test.ts`**

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  registerProgram,
  getProgramSource,
  _resetProgramRegistryForTests,
} from './registerProgram';

const MINIMAL_FRAG = `#version 300 es
precision highp float;
out vec4 outColor;
void main() { outColor = vec4(0.0, 0.5, 1.0, 1.0); }
`;

describe('registerProgram', () => {
  beforeEach(() => _resetProgramRegistryForTests());

  it('returns a handle with the given id', () => {
    const h = registerProgram('test-prog', '', MINIMAL_FRAG);
    expect(h.id).toBe('test-prog');
  });

  it('stores sources retrievable via getProgramSource', () => {
    registerProgram('prog-a', 'vertex-src', MINIMAL_FRAG);
    const src = getProgramSource('prog-a');
    expect(src?.vert).toBe('vertex-src');
    expect(src?.frag).toBe(MINIMAL_FRAG);
  });

  it('getProgramSource returns null for unknown id', () => {
    expect(getProgramSource('not-registered')).toBeNull();
  });

  it('throws on duplicate id in prod mode', () => {
    // Temporarily simulate prod.
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      registerProgram('dup-test', '', MINIMAL_FRAG);
      expect(() => registerProgram('dup-test', '', MINIMAL_FRAG)).toThrow(/duplicate/i);
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('replaces source on duplicate id in dev mode', () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    try {
      registerProgram('hot-prog', '', MINIMAL_FRAG);
      const frag2 = MINIMAL_FRAG.replace('0.5', '0.8');
      registerProgram('hot-prog', '', frag2);
      expect(getProgramSource('hot-prog')?.frag).toContain('0.8');
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  it('handle id matches the registered id', () => {
    const h = registerProgram('match-id', '', MINIMAL_FRAG);
    expect(getProgramSource(h.id)).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

```bash
pnpm --filter weasel-gl test --run registerProgram
```

Expected: 6/6 pass.

- [ ] **Step 4: Typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

- [ ] **Step 5: Commit** (bundle with DrawCommand.ts changes from Task 4)

```bash
git add \
  packages/weasel-gl/src/registerProgram.ts \
  packages/weasel-gl/src/registerProgram.test.ts \
  packages/weasel-gl/src/DrawCommand.ts
git commit -m "feat(weasel-gl): ShaderProgramHandle + registerProgram source registry + ShaderDrawCommand type"
```

---

## Task 6: Extend `WeaselRenderer` with `programRegistry` and compile-on-register

**Files:** `src/WeaselRenderer.ts`

`WeaselRenderer` gains:
1. `programRegistry: Map<string, ShaderProgram>` — compiled GL programs, keyed by the same id as the source registry.
2. `quadVao / quadVbo / quadIbo` — the single auto-quad geometry, uploaded once in the constructor and reused for all `kind: 'shader'` draws.
3. `registerProgram(handle)` — looks up source via `getProgramSource(handle.id)`, concatenates the prelude vertex shader if `vert === ''`, compiles via `new ShaderProgram(gl, vert, frag)` (which throws `ShaderCompileError` on failure), stores result.
4. Context-restore: recompiles all registered programs and re-uploads quad geometry.
5. `textureRegistry` passthrough — `registerTexture` results are stored module-level; `drawShader` uploads lazily via `textureCache`.

The `DrawContext` interface in `draw.ts` gains `programRegistry` and `quadVao` so `drawShader` can access them (Task 7).

> Convention §2 note: `ShaderCompileError` is already implemented in `ShaderProgram.ts`. Import and re-throw it unchanged.

- [ ] **Step 1: Add imports to `WeaselRenderer.ts`**

Add to the existing import block:

```ts
import {
  CUSTOM_VERT_SRC, CUSTOM_ATTRIBUTES, CUSTOM_KIT_UNIFORMS,
  QUAD_VERTICES, QUAD_INDICES,
} from './shaders/customPrelude';
import { getProgramSource } from './registerProgram';
import type { ShaderProgramHandle } from './registerProgram';
```

- [ ] **Step 2: Add fields to `WeaselRenderer` class**

```ts
private programRegistry = new Map<string, ShaderProgram>();
private quadVao: WebGLVertexArrayObject | null = null;
private quadVbo: WebGLBuffer | null = null;
private quadIbo: WebGLBuffer | null = null;
```

- [ ] **Step 3: Wire quad geometry upload in constructor**

After `this.textureCache = new GLTextureCache(this.gl);`, add:

```ts
this.uploadQuadGeometry();
```

Add private method:

```ts
private uploadQuadGeometry(): void {
  const gl = this.gl;
  this.quadVao = gl.createVertexArray();
  this.quadVbo = gl.createBuffer();
  this.quadIbo = gl.createBuffer();
  if (!this.quadVao || !this.quadVbo || !this.quadIbo) {
    throw new Error('WeaselRenderer: failed to create quad geometry buffers');
  }
  gl.bindVertexArray(this.quadVao);

  gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.STATIC_DRAW);

  // Attribute layout: stride 16 bytes (4 floats), position @ 0, uv @ 8.
  // We don't know attribute locations until a program is compiled, so we
  // configure attribute pointers dynamically at draw time (see drawShader).
  // Only IBO is bound here so the VAO captures the index buffer binding.
  gl.bindVertexArray(null);
}
```

> **Implementation note:** Because attribute locations vary per program, we cannot configure `vertexAttribPointer` in a shared VAO ahead of time. Instead, `drawShader` (Task 7) will bind a per-program VAO that wraps the same VBO/IBO. Alternatively, `drawShader` can rebind attributes each draw using the shared quad VBO without a VAO at all (similar to the dynamic text draw path in step 3). Either approach is acceptable; the plan prefers the simpler "rebind per draw" approach to keep this task small.

Simplify: remove `uploadQuadGeometry` VAO creation — just upload VBO + IBO:

```ts
private uploadQuadGeometry(): void {
  const gl = this.gl;
  this.quadVbo = gl.createBuffer();
  this.quadIbo = gl.createBuffer();
  if (!this.quadVbo || !this.quadIbo) {
    throw new Error('WeaselRenderer: failed to create quad geometry buffers');
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, this.quadVbo);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTICES, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.quadIbo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, QUAD_INDICES, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}
```

- [ ] **Step 4: Add `registerProgram` method to `WeaselRenderer`**

```ts
/**
 * Compile a consumer-registered shader program against this renderer's GL context.
 *
 * Call once per renderer after calling the module-level `registerProgram()`.
 * Throws `ShaderCompileError` with `stage` and `log` if compilation fails.
 *
 * In dev mode, calling again with the same handle replaces the compiled program
 * (hot-reload). In prod, re-compilation for an already-compiled id is a no-op
 * (source-level dedup is handled in registerProgram; this just re-uses the
 * compiled result).
 *
 * @experimental
 */
registerProgram(handle: ShaderProgramHandle): void {
  const src = getProgramSource(handle.id);
  if (!src) {
    throw new Error(
      `WeaselRenderer.registerProgram: program "${handle.id}" not found in source registry. ` +
      `Call the module-level registerProgram() first.`,
    );
  }
  const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
  const fragSrc = src.frag;
  // ShaderProgram constructor throws ShaderCompileError on failure — propagate it.
  const program = new ShaderProgram(this.gl, vertSrc, fragSrc);
  program.lookupUniforms([...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(fragSrc)]);
  program.lookupAttributes(CUSTOM_ATTRIBUTES);
  this.programRegistry.set(handle.id, program);
}
```

Add the `extractUniformNames` helper in the same file (or as a small utility):

```ts
/**
 * Extract declared uniform names from GLSL source.
 * Matches `uniform <type> <name>;` patterns; does not parse structs or arrays.
 * Used to pre-look up locations for consumer-declared uniforms.
 */
function extractUniformNames(glsl: string): string[] {
  const re = /\buniform\s+\S+\s+(\w+)\s*;/g;
  const names: string[] = [];
  let m;
  while ((m = re.exec(glsl)) !== null) names.push(m[1]);
  return names;
}
```

- [ ] **Step 5: Wire context-restore**

In `onContextRestored()`, after the existing restore code (recompiling `pathFill`, `textSdf`, re-creating `meshCache`, `textureCache`), add:

```ts
// Re-upload quad geometry to the new context.
this.uploadQuadGeometry();

// Recompile all consumer programs against the new context.
// Source is still in the module-level registry; just recompile.
for (const [id] of this.programRegistry) {
  const src = getProgramSource(id);
  if (!src) continue;
  const vertSrc = src.vert === '' ? CUSTOM_VERT_SRC : src.vert;
  try {
    const program = new ShaderProgram(this.gl, vertSrc, src.frag);
    program.lookupUniforms([...CUSTOM_KIT_UNIFORMS, ...extractUniformNames(src.frag)]);
    program.lookupAttributes(CUSTOM_ATTRIBUTES);
    this.programRegistry.set(id, program);
  } catch (e) {
    console.error(`weasel-gl: failed to recompile program "${id}" after context restore:`, e);
  }
}
```

- [ ] **Step 6: Expose registry in `DrawContext` (wired in Task 7)**

Add `_programRegistry` and `_quadVbo`/`_quadIbo` internal accessors following the existing `_gl()` / `_pathFill()` pattern:

```ts
/** @internal */ _programRegistry(): Map<string, ShaderProgram> { return this.programRegistry; }
/** @internal */ _quadVbo(): WebGLBuffer | null { return this.quadVbo; }
/** @internal */ _quadIbo(): WebGLBuffer | null { return this.quadIbo; }
```

- [ ] **Step 7: Run existing tests to check for regressions**

```bash
pnpm --filter weasel-gl test --run
```

Expected: existing test count passes (no regressions).

- [ ] **Step 8: Typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

- [ ] **Step 9: Commit**

```bash
git add packages/weasel-gl/src/WeaselRenderer.ts packages/weasel-gl/src/shaders/customPrelude.ts
git commit -m "feat(weasel-gl): add programRegistry + quad geometry + renderer.registerProgram()"
```

---

## Task 7: `setUniform` helper and `drawShader` in `draw.ts`

**Files:** `src/draw.ts`

This is the most complex single task. It adds:
1. `setUniform(gl, loc, value, textureCache, nextTexUnit)` — type-dispatch uniform setter.
2. `drawShader(ctx, cmd)` — bind quad geometry, set kit uniforms (`u_bounds`, `u_view`, `u_proj`), iterate `cmd.uniforms` via `setUniform`, draw 6 indices.
3. `'shader'` case in `dispatch`.
4. Update `DrawContext` with `programRegistry`, `quadVbo`, `quadIbo`.

> Convention §2: `u_bounds` and `u_view` are set by the renderer, not the consumer. The comment in `drawShader` must note that premultiplied alpha is the consumer's responsibility.

> Convention §1: the mock GL recorder does not verify pixel output. Playwright smoke (Task 13) is required for visual correctness.

- [ ] **Step 1: Update `DrawContext` interface**

Add to the existing `DrawContext` interface:

```ts
programRegistry: Map<string, ShaderProgram>;
quadVbo: WebGLBuffer | null;
quadIbo: WebGLBuffer | null;
```

Add imports at top of `draw.ts`:

```ts
import type { ShaderDrawCommand } from './DrawCommand';
import { CUSTOM_ATTRIBUTES, CUSTOM_KIT_UNIFORMS } from './shaders/customPrelude';
import { getTexture } from './registerTexture';
import type { ShaderUniform } from './registerProgram';
import type { TextureHandle } from './registerTexture';
```

- [ ] **Step 2: Add `setUniform` helper**

```ts
/**
 * Bind a single ShaderUniform value to a GL uniform location.
 *
 * Type detection order (matches ShaderUniform union discriminants):
 *   1. TextureHandle (has `.id` string) — bind to next tex unit, set sampler.
 *   2. Float32Array — length 9 → mat3, length 16 → mat4.
 *      Other lengths are dev-mode errors (ignored in prod).
 *   3. Array literals [n], [n,n], [n,n,n], [n,n,n,n] — uniform1f..uniform4fv.
 *      Length 1 treated as scalar. Other lengths are dev-mode errors.
 *   4. number — uniform1f.
 *
 * @param nextTexUnit  Mutable box `{ value: number }` — incremented per texture bind.
 *   Start at 1 (unit 0 may be used by existing sampler binds in the same program).
 *   The caller owns this object across the full uniforms loop.
 */
function setUniform(
  gl: WebGL2RenderingContext,
  loc: WebGLUniformLocation,
  value: ShaderUniform,
  textureCache: GLTextureCache,
  nextTexUnit: { value: number },
): void {
  // 1. TextureHandle: has a string .id property.
  if (value !== null && typeof value === 'object' && 'id' in value && typeof (value as TextureHandle).id === 'string') {
    const handle = value as TextureHandle;
    const entry = getTexture(handle.id);
    if (!entry) {
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      if (isDev) console.warn(`weasel-gl setUniform: TextureHandle "${handle.id}" not registered`);
      return;
    }
    const unit = nextTexUnit.value++;
    textureCache.upload(handle.id, entry.source);
    textureCache.bind(handle.id, unit);
    gl.uniform1i(loc, unit);
    return;
  }

  // 2. Float32Array — mat3 or mat4.
  if (value instanceof Float32Array) {
    if (value.length === 9) {
      gl.uniformMatrix3fv(loc, false, value);
    } else if (value.length === 16) {
      gl.uniformMatrix4fv(loc, false, value);
    } else {
      const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
      if (isDev) throw new TypeError(`weasel-gl setUniform: Float32Array must be length 9 (mat3) or 16 (mat4), got ${value.length}`);
    }
    return;
  }

  // 3. Array literal: [n,n], [n,n,n], or [n,n,n,n].
  if (Array.isArray(value)) {
    switch (value.length) {
      case 2: gl.uniform2fv(loc, value as [number, number]); break;
      case 3: gl.uniform3fv(loc, value as [number, number, number]); break;
      case 4: gl.uniform4fv(loc, value as [number, number, number, number]); break;
      default: {
        const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
        if (isDev) throw new TypeError(`weasel-gl setUniform: array length ${value.length} not supported`);
      }
    }
    return;
  }

  // 4. number — scalar float.
  if (typeof value === 'number') {
    gl.uniform1f(loc, value);
    return;
  }
}
```

- [ ] **Step 3: Add `warnOnce` helper** (for missing uniforms at draw time)

```ts
const warnedUniforms = new Set<string>();

function warnOnceUniform(programId: string, name: string): void {
  const key = `${programId}:${name}`;
  if (warnedUniforms.has(key)) return;
  warnedUniforms.add(key);
  const isDev = typeof process !== 'undefined' ? process.env.NODE_ENV !== 'production' : true;
  if (isDev) {
    console.warn(`weasel-gl drawShader: uniform "${name}" not found in program "${programId}". ` +
      `Check spelling, ensure it's used in the shader (unused uniforms are optimized away by the driver).`);
  }
}
```

- [ ] **Step 4: Add `drawShader` function**

```ts
function drawShader(ctx: DrawContext, cmd: ShaderDrawCommand): void {
  const { gl, programRegistry, quadVbo, quadIbo, textureCache } = ctx;

  const program = programRegistry.get(cmd.program.id);
  if (!program) {
    console.warn(
      `weasel-gl drawShader: program "${cmd.program.id}" not compiled on this renderer. ` +
      `Call renderer.registerProgram(handle) after the module-level registerProgram().`,
    );
    return;
  }

  if (!quadVbo || !quadIbo) {
    console.warn('weasel-gl drawShader: quad geometry not initialized');
    return;
  }

  gl.useProgram(program.handle);

  // Set up quad geometry: VBO + IBO, attribute pointers.
  const aPosLoc = program.attribute('a_position');
  const aUvLoc  = program.attribute('a_uv');

  gl.bindBuffer(gl.ARRAY_BUFFER, quadVbo);
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 16, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, 16, 8);
  }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, quadIbo);

  // Kit-managed uniforms: u_proj, u_bounds, u_view.
  const proj = mat3.screenToClip(ctx.widthCss, ctx.heightCss);
  const uProj = program.uniform('u_proj');
  if (uProj !== undefined) gl.uniformMatrix3fv(uProj, false, proj);

  const uBounds = program.uniform('u_bounds');
  if (uBounds !== undefined) {
    gl.uniform4f(uBounds, cmd.bounds.x, cmd.bounds.y, cmd.bounds.w, cmd.bounds.h);
  }

  // u_view: pass the current group transform (which is the view matrix in screen-space draws).
  // For world-space shader draws, consumers use v_world from the vertex shader.
  const uView = program.uniform('u_view');
  if (uView !== undefined) gl.uniformMatrix3fv(uView, false, ctx.state.transform);

  // Consumer uniforms — bound in iteration order.
  // Texture units start at 1 (unit 0 reserved for future built-in sampler if needed).
  const nextTexUnit = { value: 1 };
  for (const [name, value] of Object.entries(cmd.uniforms)) {
    const loc = program.uniform(name);
    if (loc === undefined) {
      warnOnceUniform(cmd.program.id, name);
      continue;
    }
    setUniform(gl, loc, value, textureCache, nextTexUnit);
  }

  // Draw quad: 6 indices, UNSIGNED_SHORT (Uint16Array QUAD_INDICES).
  gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

  // Clean up attribute state.
  if (aPosLoc !== undefined) gl.disableVertexAttribArray(aPosLoc);
  if (aUvLoc  !== undefined) gl.disableVertexAttribArray(aUvLoc);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
}
```

- [ ] **Step 5: Add `'shader'` case to `dispatch`**

```ts
case 'shader': return drawShader(ctx, cmd);
```

- [ ] **Step 6: Wire `DrawContext` in `WeaselRenderer.render()`**

In `WeaselRenderer.render()`, add the new fields to the `ctx` object:

```ts
const ctx: DrawContext = {
  gl,
  pathFill: this.pathFill,
  textSdf: this.textSdf,
  meshCache: this.meshCache,
  textureCache: this.textureCache,
  programRegistry: this.programRegistry,
  quadVbo: this.quadVbo,
  quadIbo: this.quadIbo,
  state: this.groupState,
  widthCss: this.widthCss,
  heightCss: this.heightCss,
};
```

- [ ] **Step 7: Run all tests**

```bash
pnpm --filter weasel-gl test --run
```

Expected: all existing tests pass + zero new failures.

- [ ] **Step 8: Typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

- [ ] **Step 9: Commit**

```bash
git add packages/weasel-gl/src/draw.ts packages/weasel-gl/src/WeaselRenderer.ts
git commit -m "feat(weasel-gl): drawShader dispatch + setUniform binder + kit quad geometry"
```

---

## Task 8: Unit tests for `drawShader` dispatch in `draw.test.ts`

**Files:** `src/draw.test.ts`

Extend the existing `draw.test.ts` with assertions for the `'shader'` dispatch path. These test the GL call sequence via the mock recorder — not pixel output (that requires Playwright per convention §1).

> Convention §1: mock GL recorder tests verify *which calls are made*, not pixel correctness. Tests here assert: program is `useProgram`'d, `drawElements` is called with the right index count and type, kit uniforms (`u_proj`, `u_bounds`, `u_view`) are set, consumer uniforms are set. Pixel output is deferred to Task 13 Playwright smoke.

- [ ] **Step 1: Add fixture — minimal shader program for tests**

Extend the `draw.test.ts` fixture setup with a compiled fake program. Use the existing recorder pattern to create a fake `ShaderProgram`-like object or stub `programRegistry` directly.

The test fixture needs:
1. A mock `programRegistry: Map<string, ShaderProgram>` with a fake compiled program.
2. Fake `quadVbo` and `quadIbo` values (any non-null object is sufficient for the recorder).
3. A `ShaderDrawCommand`.

```ts
// In draw.test.ts — add to the imports:
import { type ShaderProgram } from './ShaderProgram';

// Add a minimal fake program stub (mirrors the approach used for pathFill in existing tests):
function makeFakeProgram(): ShaderProgram {
  // Enough of ShaderProgram's interface for drawShader to work with the GL recorder.
  const uniforms = new Map<string, WebGLUniformLocation>([
    ['u_proj',   'loc_u_proj'   as unknown as WebGLUniformLocation],
    ['u_bounds', 'loc_u_bounds' as unknown as WebGLUniformLocation],
    ['u_view',   'loc_u_view'   as unknown as WebGLUniformLocation],
    ['u_time',   'loc_u_time'   as unknown as WebGLUniformLocation],
  ]);
  const attribs = new Map<string, number>([
    ['a_position', 0],
    ['a_uv', 1],
  ]);
  return {
    handle: 'fake-program-handle' as unknown as WebGLProgram,
    uniform: (name: string) => uniforms.get(name),
    attribute: (name: string) => attribs.get(name),
  } as unknown as ShaderProgram;
}
```

- [ ] **Step 2: Add shader dispatch tests**

```ts
describe('drawShader', () => {
  it('calls useProgram with the compiled program handle', () => {
    const { ctx, recorder } = makeTestCtx(); // existing helper
    const program = makeFakeProgram();
    ctx.programRegistry.set('test', program);
    ctx.quadVbo = recorder.createBuffer() as WebGLBuffer;
    ctx.quadIbo = recorder.createBuffer() as WebGLBuffer;

    dispatch(ctx, {
      kind: 'shader',
      program: { id: 'test' },
      uniforms: {},
      bounds: { x: 10, y: 20, w: 100, h: 50 },
    });

    const useProgramCalls = recorder.calls.filter(c => c.method === 'useProgram');
    expect(useProgramCalls.length).toBeGreaterThan(0);
    expect(useProgramCalls[0].args[0]).toBe(program.handle);
  });

  it('calls drawElements with 6 indices and UNSIGNED_SHORT', () => {
    const { ctx, recorder } = makeTestCtx();
    const program = makeFakeProgram();
    ctx.programRegistry.set('test', program);
    ctx.quadVbo = recorder.createBuffer() as WebGLBuffer;
    ctx.quadIbo = recorder.createBuffer() as WebGLBuffer;

    dispatch(ctx, {
      kind: 'shader',
      program: { id: 'test' },
      uniforms: {},
      bounds: { x: 0, y: 0, w: 50, h: 50 },
    });

    const drawCalls = recorder.calls.filter(c => c.method === 'drawElements');
    expect(drawCalls.length).toBe(1);
    expect(drawCalls[0].args[1]).toBe(6); // index count
    // args[2] is the type constant — UNSIGNED_SHORT
  });

  it('logs a warning and skips draw when program not in registry', () => {
    const { ctx } = makeTestCtx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    dispatch(ctx, {
      kind: 'shader',
      program: { id: 'not-compiled' },
      uniforms: {},
      bounds: { x: 0, y: 0, w: 50, h: 50 },
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('not-compiled'));
    warn.mockRestore();
  });

  it('sets u_bounds uniform with the bounds rect values', () => {
    const { ctx, recorder } = makeTestCtx();
    const program = makeFakeProgram();
    ctx.programRegistry.set('test', program);
    ctx.quadVbo = recorder.createBuffer() as WebGLBuffer;
    ctx.quadIbo = recorder.createBuffer() as WebGLBuffer;

    dispatch(ctx, {
      kind: 'shader',
      program: { id: 'test' },
      uniforms: {},
      bounds: { x: 10, y: 20, w: 100, h: 50 },
    });

    const uniform4fCalls = recorder.calls.filter(c => c.method === 'uniform4f');
    // At least one call should be for u_bounds with the values (10, 20, 100, 50).
    expect(uniform4fCalls.some(c =>
      c.args[1] === 10 && c.args[2] === 20 && c.args[3] === 100 && c.args[4] === 50,
    )).toBe(true);
  });

  it('binds scalar consumer uniform via uniform1f', () => {
    const { ctx, recorder } = makeTestCtx();
    const program = makeFakeProgram();
    ctx.programRegistry.set('test', program);
    ctx.quadVbo = recorder.createBuffer() as WebGLBuffer;
    ctx.quadIbo = recorder.createBuffer() as WebGLBuffer;

    dispatch(ctx, {
      kind: 'shader',
      program: { id: 'test' },
      uniforms: { u_time: 3.14 },
      bounds: { x: 0, y: 0, w: 50, h: 50 },
    });

    const uniform1fCalls = recorder.calls.filter(c => c.method === 'uniform1f');
    expect(uniform1fCalls.some(c => Math.abs(c.args[1] - 3.14) < 0.001)).toBe(true);
  });
});
```

> **Note for implementer:** The `makeTestCtx()` helper and recorder pattern are established in the existing `draw.test.ts`. Add `programRegistry: new Map()`, `quadVbo: null`, `quadIbo: null` to the context shape returned by that helper. Check the existing helper's shape and extend it rather than creating a parallel helper.

- [ ] **Step 3: Run draw tests**

```bash
pnpm --filter weasel-gl test --run draw
```

Expected: all draw tests pass including the new shader ones.

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-gl/src/draw.test.ts
git commit -m "test(weasel-gl): unit tests for drawShader dispatch path"
```

---

## Task 9: `setUniform` unit tests

**Files:** `src/draw.test.ts` (or a standalone `src/setUniform.test.ts` if the implementer prefers)

The `setUniform` helper's type-dispatch is complex enough to warrant targeted unit tests independent of a full draw call.

> **Implementer choice:** `setUniform` is currently a module-private function in `draw.ts`. For testability, either (a) export it as `export function setUniform(...)` with `@internal`, or (b) test it indirectly through `drawShader` tests in Task 8. Option (b) is acceptable for this step — this task is lower priority than the smoke test (Task 13). Use judgment.

- [ ] **Step 1: Test type detection — number → uniform1f**

```ts
it('setUniform: number dispatches to uniform1f', () => { /* verify via drawShader uniforms: {u_time: 2.5} */ });
```

- [ ] **Step 2: Test type detection — [n,n] → uniform2fv**

```ts
it('setUniform: [n,n] dispatches to uniform2fv', () => { /* uniforms: { u_pos: [10, 20] } */ });
```

- [ ] **Step 3: Test type detection — Float32Array(9) → uniformMatrix3fv**

```ts
it('setUniform: Float32Array(9) dispatches to uniformMatrix3fv', () => { /* ... */ });
```

- [ ] **Step 4: Test type detection — Float32Array(16) → uniformMatrix4fv**

- [ ] **Step 5: Test TextureHandle → bind + uniform1i** (requires a registered texture)

- [ ] **Step 6: Run tests**

```bash
pnpm --filter weasel-gl test --run
```

- [ ] **Step 7: Commit**

```bash
git add packages/weasel-gl/src/draw.test.ts
git commit -m "test(weasel-gl): setUniform type-dispatch unit tests"
```

---

## Task 10: Update `index.ts` barrel exports

**Files:** `src/index.ts`

- [ ] **Step 1: Add exports to `src/index.ts`**

```ts
export {
  registerProgram,
  type ShaderProgramHandle,
  type ShaderUniform,
} from './registerProgram';
export { registerTexture, type TextureHandle } from './registerTexture';
export type { ShaderDrawCommand } from './DrawCommand';
export { ShaderCompileError } from './ShaderProgram'; // already exported; ensure it's in barrel
```

> `ShaderCompileError` may already be exported from step 1. Check and add only if missing.

- [ ] **Step 2: Update the barrel comment**

Update the package-level comment in `index.ts` to include step 6:

```ts
 * Through step 6: … plus experimental custom shader API (registerProgram, registerTexture,
 * kind:'shader' DrawCommand, ShaderProgramHandle, TextureHandle, ShaderUniform, ShaderCompileError).
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-gl/src/index.ts
git commit -m "feat(weasel-gl): export registerProgram, registerTexture, shader types in public barrel"
```

---

## Task 11: Dev page — Voronoi shader demo (`dev/shader.html` + `dev/shader.ts`)

**Files:**
- Create: `dev/shader.html`
- Create: `dev/shader.ts`

This is the smoke-test entry point for the Playwright spec. It renders a Voronoi noise pattern in a 300×300 rect, updated each frame with `performance.now()` as a time uniform.

> Convention §6: `getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })` — required for Playwright pixel readback. This is a test-only concern; real consumers don't need it.
>
> Convention §2: the fragment shader in this fixture outputs premultiplied alpha. This is non-negotiable and must be verified in the Playwright smoke.

- [ ] **Step 1: Create `dev/shader.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>weasel-gl — shader smoke</title>
  <style>
    body { margin: 0; background: #1a1a2e; display: flex; align-items: center; justify-content: center; height: 100vh; }
    canvas { border: 1px solid #444; }
  </style>
</head>
<body>
  <canvas id="c" width="512" height="512"></canvas>
  <script type="module" src="./shader.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create `dev/shader.ts`**

The Voronoi fragment shader is the spec's designated smoke test. The shader computes 2D Voronoi noise and outputs a color. It reads `u_time` (float) and `v_uv` (from the prelude).

**IMPORTANT:** the fragment shader outputs premultiplied alpha per convention §2. Since the Voronoi result is fully opaque (a=1), premultiplying has no visible effect — but writing it correctly establishes the pattern.

```ts
/**
 * shader smoke page — Voronoi noise in a bounded rect, animated via u_time.
 *
 * Convention §2: the fragment shader outputs premultiplied alpha:
 *   outColor = vec4(color.rgb * color.a, color.a)
 * For opaque output (a=1) this is identical to outColor = vec4(color.rgb, 1.0).
 *
 * Convention §6: getContext uses preserveDrawingBuffer:true + stencil:true
 * so Playwright can read pixels back after render.
 */

import { WeaselRenderer, registerProgram } from '../src/index';

const VORONOI_FRAG = /* glsl */ `#version 300 es
precision highp float;

// Varyings from the kit vertex prelude:
in vec2 v_uv;       // 0..1 across the bounds rect
in vec2 v_screen;   // screen-space pixel coord (unused here)
in vec2 v_world;    // world-space coord (unused here)

// Kit-managed uniforms (declared by the prelude):
uniform vec4 u_bounds;
uniform mat3 u_view;

// Consumer uniforms:
uniform float u_time;

out vec4 outColor;

// Hash function for Voronoi point placement.
vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// 2D Voronoi — returns (minDist, secondMinDist).
vec2 voronoi(vec2 uv, float time) {
  vec2 i = floor(uv);
  vec2 f = fract(uv);
  float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = hash2(i + neighbor);
      point = 0.5 + 0.5 * sin(time + 6.2831 * point);
      vec2 diff = neighbor + point - f;
      float d = length(diff);
      if (d < d1) { d2 = d1; d1 = d; }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec2(d1, d2);
}

void main() {
  vec2 uv = v_uv * 6.0; // scale: ~6 cells across the rect
  vec2 v = voronoi(uv, u_time * 0.5);

  // Color: border = bright, interior = dark teal/blue gradient.
  float border = smoothstep(0.04, 0.07, v.y - v.x);
  vec3 color = mix(vec3(0.05, 0.3, 0.4), vec3(0.0, 0.8, 1.0), border);
  color = mix(color, vec3(1.0), smoothstep(0.02, 0.0, v.x));

  // PREMULTIPLIED ALPHA (conventions §2): a = 1.0 here, so rgb * a = rgb.
  float a = 1.0;
  outColor = vec4(color * a, a);
}
`;

const canvas = document.getElementById('c') as HTMLCanvasElement;
// Convention §6: preserveDrawingBuffer for Playwright readback; stencil for consistency.
const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, stencil: true });
if (!gl) throw new Error('WebGL2 not available');

const renderer = new WeaselRenderer({ gl, width: 512, height: 512, dpr: 1 });

// Register program at module level — pass empty vert to use kit prelude.
const handle = registerProgram('voronoi', '', VORONOI_FRAG);

// Register with this renderer (compiles to GL).
renderer.registerProgram(handle);

function frame(): void {
  const t = performance.now() / 1000;
  renderer.render([{
    kind: 'shader',
    program: handle,
    uniforms: {
      u_time: t,
    },
    bounds: { x: 106, y: 106, w: 300, h: 300 },
  }]);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
```

- [ ] **Step 3: Register the page in `dev/vite.config.ts`** (if the dev server uses explicit entry points; check existing config)

If `dev/vite.config.ts` has an explicit `input` array in `build.rollupOptions`, add `shader: resolve(__dirname, 'dev/shader.html')`.

- [ ] **Step 4: Manual browser smoke**

```bash
pnpm --filter weasel-gl dev
# open http://localhost:5173/dev/shader.html
```

Verify: Voronoi pattern renders in the 300×300 rect, animates smoothly, background is dark (`#1a1a2e`).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-gl/dev/shader.html packages/weasel-gl/dev/shader.ts
git commit -m "feat(weasel-gl): Voronoi shader demo page for smoke testing"
```

---

## Task 12: Playwright smoke spec (`dev/shader.spec.ts`)

**Files:**
- Create: `dev/shader.spec.ts`

> Convention §1: pixel readback from a real browser is required — mock GL does not catch rendering bugs.
> Convention §6: `preserveDrawingBuffer: true` is already set on the dev page (Task 11).
> Convention §8 (update from step 3): use **grid sampling** not diagonal, since the shader draws in a specific subrect.

- [ ] **Step 1: Create `dev/shader.spec.ts`**

```ts
/**
 * Playwright smoke spec for the kind:'shader' draw path.
 *
 * Verifies:
 *   1. The Voronoi shader renders non-black pixels inside the bounds rect.
 *   2. Pixels outside the bounds rect are the background color (transparent/dark).
 *   3. No GL errors occur during rendering.
 *
 * Pixel sampling: grid sampling (8×8 = 64 samples inside the bounds rect),
 * per convention §8 (updated in step 3 — grid is more robust than diagonal).
 */

import { test, expect } from '@playwright/test';

const PAGE = 'http://localhost:5173/dev/shader.html';

// Bounds rect from shader.ts: x=106, y=106, w=300, h=300.
const BOUNDS = { x: 106, y: 106, w: 300, h: 300 };

test.describe('shader smoke', () => {
  test('Voronoi pattern renders non-trivial pixels inside bounds', async ({ page }) => {
    await page.goto(PAGE);
    // Wait for first frame.
    await page.waitForTimeout(200);

    // Capture canvas as PNG.
    const canvas = page.locator('canvas#c');
    const screenshot = await canvas.screenshot();

    // Parse PNG pixels manually using sharp or pixelmatch helpers — or use
    // page.evaluate to read pixel data directly via readPixels on a known coord.

    // Strategy: read a pixel near the center of the bounds rect via JS eval.
    const centerX = BOUNDS.x + BOUNDS.w / 2;
    const centerY = BOUNDS.y + BOUNDS.h / 2;

    const pixel = await page.evaluate(({ x, y }: { x: number; y: number }) => {
      const c = document.getElementById('c') as HTMLCanvasElement;
      const gl = c.getContext('webgl2') as WebGL2RenderingContext;
      const buf = new Uint8Array(4);
      // Note: WebGL y is flipped relative to canvas coords.
      const glY = c.height - y - 1;
      gl.readPixels(x, glY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return Array.from(buf);
    }, { x: centerX, y: centerY });

    // Pixel inside the Voronoi region should not be [0,0,0,0] (transparent / unrendered).
    expect(pixel[3]).toBeGreaterThan(200); // alpha > 200 (opaque-ish)
    // At least one of R/G/B should be non-trivial (the Voronoi shader produces blue-green tones).
    const maxChannel = Math.max(pixel[0], pixel[1], pixel[2]);
    expect(maxChannel).toBeGreaterThan(30);
  });

  test('pixels outside bounds are not overwritten by shader', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForTimeout(200);

    // Sample a pixel clearly outside the bounds rect (e.g. top-left corner, x=10, y=10).
    const pixel = await page.evaluate(() => {
      const c = document.getElementById('c') as HTMLCanvasElement;
      const gl = c.getContext('webgl2') as WebGL2RenderingContext;
      const buf = new Uint8Array(4);
      gl.readPixels(10, c.height - 10 - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
      return Array.from(buf);
    });

    // Outside the bounds: renderer clears to (0,0,0,0) each frame.
    // The background of the dev page is CSS (#1a1a2e) but the WebGL canvas is transparent.
    expect(pixel[3]).toBeLessThan(50); // alpha ~ 0 (canvas is transparent outside bounds)
  });

  test('grid of samples inside bounds are all non-trivial', async ({ page }) => {
    await page.goto(PAGE);
    await page.waitForTimeout(200);

    // 4×4 = 16 grid samples inside the bounds rect.
    const GRID = 4;
    const results = await page.evaluate(({ bounds, grid }: { bounds: typeof BOUNDS; grid: number }) => {
      const c = document.getElementById('c') as HTMLCanvasElement;
      const gl = c.getContext('webgl2') as WebGL2RenderingContext;
      const pixels: number[][] = [];
      for (let row = 0; row < grid; row++) {
        for (let col = 0; col < grid; col++) {
          const x = Math.round(bounds.x + (col + 0.5) * bounds.w / grid);
          const y = Math.round(bounds.y + (row + 0.5) * bounds.h / grid);
          const buf = new Uint8Array(4);
          gl.readPixels(x, c.height - y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          pixels.push(Array.from(buf));
        }
      }
      return pixels;
    }, { bounds: BOUNDS, grid: GRID });

    // All sampled pixels should have alpha > 200 (fully opaque quad was drawn).
    for (const [, , , a] of results) {
      expect(a).toBeGreaterThan(200);
    }
  });
});
```

- [ ] **Step 2: Run Playwright spec**

```bash
pnpm --filter weasel-gl test:smoke
# or: pnpm exec playwright test dev/shader.spec.ts
```

Expected: 3/3 pass.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/dev/shader.spec.ts
git commit -m "test(weasel-gl): Playwright smoke spec for kind:shader dispatch path"
```

---

## Task 13: `ShaderCompileError` integration test (throw-on-bad-shader)

**Files:** (add to `src/WeaselRenderer.test.ts` or a new `registerProgram.integration.test.ts`)

This test verifies that calling `renderer.registerProgram(handle)` with syntactically invalid GLSL throws a `ShaderCompileError` with the correct `stage` and a non-empty `log`. It requires a real GL context (uses `OffscreenCanvas`) — not the mock recorder.

> Convention §1: the mock recorder stubs `getShaderParameter` to return true (compile success). This test requires a **real WebGL2 context** to exercise the actual driver compile path.
>
> Note: OffscreenCanvas WebGL2 availability in Node/vitest depends on the test environment. If vitest is configured with `jsdom`, `OffscreenCanvas` may be stubbed or absent. If this test fails in CI due to missing WebGL2, mark it as `test.skipIf(!hasWebGL2, ...)` with a comment.

- [ ] **Step 1: Add the integration test**

```ts
// src/registerProgram.integration.test.ts

import { describe, it, expect } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import { registerProgram, _resetProgramRegistryForTests } from './registerProgram';
import { ShaderCompileError } from './ShaderProgram';

function tryGetWebGL2(): WebGL2RenderingContext | null {
  try {
    const canvas = new OffscreenCanvas(1, 1);
    return canvas.getContext('webgl2') as WebGL2RenderingContext | null;
  } catch {
    return null;
  }
}

const gl = tryGetWebGL2();
const skipNoGL = gl ? describe : describe.skip;

skipNoGL('WeaselRenderer.registerProgram (real GL context)', () => {
  beforeEach(() => _resetProgramRegistryForTests());

  it('throws ShaderCompileError with stage:"fragment" on invalid fragment GLSL', () => {
    const renderer = new WeaselRenderer({ gl: gl!, width: 100, height: 100, dpr: 1 });
    const handle = registerProgram('bad-frag', '', `
      #version 300 es
      precision highp float;
      out vec4 outColor;
      void main() {
        this is not valid glsl !!!
      }
    `);
    expect(() => renderer.registerProgram(handle)).toThrow(ShaderCompileError);
    try {
      renderer.registerProgram(handle);
    } catch (e) {
      expect(e).toBeInstanceOf(ShaderCompileError);
      const sce = e as ShaderCompileError;
      expect(sce.stage).toBe('fragment');
      expect(sce.log.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter weasel-gl test --run registerProgram.integration
```

Expected: passes (or skips cleanly if WebGL2 unavailable in test environment).

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-gl/src/registerProgram.integration.test.ts
git commit -m "test(weasel-gl): ShaderCompileError integration test via OffscreenCanvas"
```

---

## Task 14: Final test run and typecheck

- [ ] **Step 1: Full vitest suite**

```bash
pnpm --filter weasel-gl test --run
```

Record the passing test count in the done note. Compare to the step-3 baseline of 1384.

- [ ] **Step 2: Full typecheck**

```bash
pnpm --filter weasel-gl typecheck
```

Expected: 0 errors.

- [ ] **Step 3: Full Playwright smoke**

```bash
pnpm --filter weasel-gl test:smoke
```

Expected: all specs pass (smoke + synthetic + text + shader = 4 specs).

- [ ] **Step 4: Commit done note**

Write `docs/superpowers/plans/2026-05-09-webgl-step-6-done.md` (controller writes this after implementation; not part of this plan).

---

## What is deferred to v2 shader API

The following items are explicitly out of scope for step 6 and are documented here so they don't slip into the implementation:

| Deferred item | Why deferred | Where to spec |
|---|---|---|
| **Consumer-supplied geometry** (custom VBOs, instancing) | Requires a new public surface for buffer descriptors; complex API. | v2 shader spec |
| **Custom vertex shaders** (beyond the kit prelude) | Consumers writing vertex shaders need to understand the coordinate system in full detail; the prelude contract is not yet stable. | v2 shader spec |
| **Multi-pass rendering / render-to-texture** | Requires FBO lifecycle API, ping-pong surface management, named attachment points. Major subproject. | v2 shader spec |
| **Kit-managed time and frame uniforms** (`u_time`, `u_frame`) | Convenient but adds kit state; defer until we know what consumers actually need. | v2 shader spec |
| **`unregisterProgram(handle)`** | Programs live for renderer lifetime in v1. Explicit disposal requires GL resource tracking. | v2 shader spec |
| **Shader source-map / line-number reporting** | `ShaderCompileError.log` contains raw GL driver output with relative line numbers; source-map shifts require preprocessing. | v2 shader spec |
| **Multi-texture consumer programs** | Step 6 texture unit allocation starts at 1 and increments per TextureHandle uniform in binding order. No explicit sampler unit control. | v2 shader spec |
| **Render order / z-sorting for shader commands** | `kind: 'shader'` commands draw in tree order alongside other commands. Explicit z-ordering or back-to-front sorting is not in scope. | Future draw-order spec |

---

## Done-note template

To be filled in after implementation:

```md
# WebGL Step 6 — Done

**Plan:** 2026-05-09-webgl-step-6-experimental-shader-api.md
**Date completed:** YYYY-MM-DD

## What shipped
…

## Notable deviations from plan
…

## Test results
- Vitest: X tests pass (Y new from step 6)
- Playwright: 4/4 smoke specs pass
- Typecheck: clean

## Lessons for step 7 and beyond
…

## Open follow-ups
…
```
