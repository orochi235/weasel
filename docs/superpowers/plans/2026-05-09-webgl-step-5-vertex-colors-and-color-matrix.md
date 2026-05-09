# WebGL Transition — Step 5: Per-Vertex Colors + Color Matrix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `@orochi235/weasel-gl` with two orthogonal color-manipulation features. (1) `vertexColors` on the `kind: 'path'` DrawCommand variant: a flat RGBA-per-vertex array that tints each vertex independently, enabling gradient-along-path effects. (2) `colorMatrix` on the `kind: 'group'` DrawCommand variant: a 4×5 (matrix + bias column) transform applied to every fragment's color in that subtree, enabling hue rotation, saturation shifts, and color tinting. Exits when test scenes for both features render correctly in headless Chromium: a gradient-along-path (red → blue via per-vertex colors on a convex polygon) and a hue-rotated subtree (normal-colored paths inside a group whose `colorMatrix` rotates hues 120°).

**Architecture (vertex colors):** The path-fill vertex shader gains a new optional attribute `a_vertexColor` (vec4). Two shader variants are compiled at renderer startup: `pathFillFlat` (no vertex-color attribute; existing behavior) and `pathFillVColor` (with `a_vertexColor`; the fragment mixes it with `u_color` by multiplication). The renderer selects the variant at draw time: if the `PathDrawCommand` carries `vertexColors`, it creates a per-draw VBO for the color data, binds it as the `a_vertexColor` attribute, and dispatches `pathFillVColor`. If `vertexColors` is absent, it uses `pathFillFlat` exactly as before (zero behavior change to existing draws). The `GLMeshCache` is unchanged — it owns only the geometry VBO + VAO, keyed by path identity. The per-draw vertex-color VBO is allocated locally inside `drawPath` (same pattern as the dynamic text VBO in step 3). This is a documented perf TODO for step 7: pool per-draw VBOs.

**Architecture (color matrix):** `GroupState` gains a third stack: `colorMatrixStack: Float32Array[]` holding 4×5 matrices (row-major; 20 floats). The 4×5 form is `SVG feColorMatrix` style: `outRGBA = M₄ₓ₄ * inRGBA + bias`, where `bias` is column 4 (indices [4,9,14,19]). Identity is the 4×5 identity-plus-zero-bias. On `push`, the new cumulative matrix is the composition `compose(outer, inner)` — inner applied after outer (same directionality as transform composition). The `pathFill` fragment shader (both variants) gains a `u_colorMatrix` uniform (mat4) and `u_colorBias` uniform (vec4); the renderer reads the cumulative colorMatrix from `GroupState` and uploads the 4×4 portion and bias column each draw call. When `GroupState.colorMatrix` is identity, an early-out branch in the shader multiplies by identity (no visual change). Premultiplied output (`vec4(rgb * a, a)`) is produced after the color matrix is applied — conventions §2 applies.

**Tech Stack:** TypeScript (strict), vitest, Playwright. No new npm dependencies.

**Spec:** [`docs/superpowers/specs/2026-05-08-webgl-transition-plan-design.md`](../specs/2026-05-08-webgl-transition-plan-design.md), Sequencing → Step 5; Architecture deltas → DrawCommand union (final shape).

**Step 4 dependency note:** Step 4 extends `Paint` with gradient variants. Step 5 is orthogonal to that: `vertexColors` affects only the vertex-attribute path, and `colorMatrix` applies after all fill/paint decisions. If step 5 lands before step 4 ships, the `drawPath` code that currently handles only `SolidPaint` is unchanged; step 5's `vertexColors` pathway still works. The implementer adjusts if step 4 shipped first (no structural conflicts expected).

## Required reading before starting

- [`webgl-stepwise-conventions.md`](./webgl-stepwise-conventions.md) — accumulated lessons. Entries §1, §2, §6, §8, §9 apply directly (see task callouts below).
- [`2026-05-09-webgl-step-3-done.md`](./2026-05-09-webgl-step-3-done.md) — most recent done note; pay attention to the per-renderer state coupling bug (§9) and the smoke sampling note (§1 update).
- `packages/weasel-gl/src/shaders/pathFill.ts` — existing path-fill shader; step 5 derives two variants from it.
- `packages/weasel-gl/src/GroupState.ts` — existing transform+alpha stack; step 5 extends it with a colorMatrix stack.
- `packages/weasel-gl/src/draw.ts` — `drawPath` and `drawGroup`; both are modified.
- `packages/weasel-gl/src/WeaselRenderer.ts` — constructor, `onContextRestored`, and `DrawContext`; gains `pathFillVColor` program.

**Conventions cited by specific tasks below:**

- Task 1 (DrawCommand types): `vertexColors` is on the `PathDrawCommand` variant, NOT on the `Path` type. Paths are cached by identity; colors are per-draw.
- Task 2 (pathFillVColor shader): conventions §2 — premultiplied output `vec4(rgb * a, a)` after color-matrix application; add the standard top-of-file comment.
- Task 3 (colorMatrix in GroupState): conventions §9 — color matrix state lives per-renderer stack, not on any shared registry or `DrawCommand` type.
- Task 7 (drawPath extension): conventions §8 — vertex position correctness can't be confirmed by the mock GL recorder; Playwright smoke required.
- Task 10 (Playwright smoke): conventions §1 (mock GL doesn't catch color correctness), §6 (`preserveDrawingBuffer: true`), §1 update (use 16×16 grid sampling, not diagonal).

**Deferred — out of scope for step 5:**

- Per-vertex colors on stroke ribbon geometry. Strokes would need UVs or vertex IDs to interpolate colors along the ribbon; complex and niche. Deferred to a future spec.
- FBO-based color grading / LUT-based color matrix. Stays CPU-uploaded uniform for now.
- Color matrix on `kind: 'path'` DrawCommands directly (only group-level is specified). Single-path color grading can be achieved by wrapping in a group.
- Buffer pooling for per-draw vertex-color VBOs. Documented TODO for step 7.

---

## File structure

Files this plan creates/modifies in `packages/weasel-gl/`:

```
src/
  shaders/
    pathFill.ts           MODIFY — add pathFillVColor variant (a_vertexColor attribute);
                                   add u_colorMatrix + u_colorBias to both variants;
                                   export PATH_FILL_VCOLOR_ATTRIBUTES and updated
                                   PATH_FILL_UNIFORMS constant.
  GroupState.ts           MODIFY — add colorMatrix stack (push/pop/get);
                                   add compose() helper for 4×5 matrices.
  GroupState.test.ts      MODIFY — add colorMatrix push/pop/compose tests.
  DrawCommand.ts          MODIFY — add vertexColors?: number[] to PathDrawCommand;
                                   add colorMatrix?: number[] to GroupDrawCommand.
  draw.ts                 MODIFY — drawPath() uploads vertex-color VBO when present,
                                   selects pathFillVColor vs pathFillFlat program;
                                   drawGroup() passes colorMatrix to GroupState.push();
                                   both drawPathFillSolid variants upload colorMatrix
                                   uniform from ctx.state.colorMatrix.
  draw.test.ts            MODIFY — assertions for vertex-color attribute upload and
                                   color-matrix uniform calls.
  WeaselRenderer.ts       MODIFY — compile pathFillVColor in constructor + restore;
                                   expose pathFillVColor via DrawContext;
                                   re-compile on context restore.

dev/
  vertex-colors.html      NEW — smoke page for per-vertex colors
  vertex-colors.ts        NEW — renders a gradient-along-path scene
  vertex-colors.spec.ts   NEW — Playwright smoke spec
  color-matrix.html       NEW — smoke page for color matrix
  color-matrix.ts         NEW — renders a hue-rotated subtree scene
  color-matrix.spec.ts    NEW — Playwright smoke spec
```

Files outside the package:

```
docs/superpowers/plans/2026-05-09-webgl-step-5-done.md   NEW (written at step end)
```

---

## Color matrix representation

**Choice: 4×5 row-major, 20 floats.**

This matches the SVG `feColorMatrix` / CSS `filter: matrix(...)` convention. Each output channel is a dot product of the 5-element input `[R, G, B, A, 1]` with one row of the matrix:

```
out.R = m[0]*in.R  + m[1]*in.G  + m[2]*in.B  + m[3]*in.A  + m[4]
out.G = m[5]*in.R  + m[6]*in.G  + m[7]*in.B  + m[8]*in.A  + m[9]
out.B = m[10]*in.R + m[11]*in.G + m[12]*in.B + m[13]*in.A + m[14]
out.A = m[15]*in.R + m[16]*in.G + m[17]*in.B + m[18]*in.A + m[19]
```

Identity (20 floats):
```
[1,0,0,0,0,  0,1,0,0,0,  0,0,1,0,0,  0,0,0,1,0]
```

The 4×5 bias-in-column approach is preferred over a separate `bias` vec4 because:
1. Consumers can supply a single `colorMatrix: number[]` (length 20) instead of two separate fields.
2. It matches the established SVG convention, so hue-rotate / saturate helpers can use known formulas.
3. Uploading to GLSL: split into `u_colorMatrix` (mat4, columns 0–3) and `u_colorBias` (vec4, column 4) at upload time. The split happens in `drawPath` — callers always supply a flat 20-element array.

**Composition of two 4×5 matrices** (`compose(outer, inner)`): given that `outer` maps `x → M_o*x + b_o` and `inner` maps `x → M_i*x + b_i`, the composed function (outer applied after inner) maps `x → M_o*(M_i*x + b_i) + b_o = (M_o*M_i)*x + (M_o*b_i + b_o)`. In code: `newM4x4 = outer.M * inner.M` (4×4 matrix multiply), `newBias = outer.M * inner.bias + outer.bias`.

**Document row-major in `GroupState.ts` header comment.** The `u_colorMatrix` uniform is uploaded as a mat4 via `gl.uniformMatrix4fv(loc, false, m4x4)` — `false` means don't transpose; the 4×4 portion is already column-major for GL (extracted from the row-major 4×5 at upload time). Extraction detail in Task 6.

---

## Task 1: Extend DrawCommand types

**Files:** `src/DrawCommand.ts`

**No new dependencies.**

- [ ] **Step 1:** Add `vertexColors?: number[]` to `PathDrawCommand`:
  ```ts
  export interface PathDrawCommand {
    kind: 'path';
    path: Path;
    fill?: SolidPaint;
    stroke?: Stroke;
    /**
     * Optional flat RGBA-per-vertex color array. Length must equal
     * `4 × vertexCount` where vertexCount matches the tessellated mesh for
     * `path`. When present, the path-fill shader interpolates per-vertex
     * colors and multiplies them with `fill.color`. When absent, the shader
     * uses `fill.color` alone (existing behavior).
     *
     * NOTE: lives on the DrawCommand variant, NOT on `Path`. Paths are cached
     * by identity and may be drawn with different per-vertex tints per frame.
     */
    vertexColors?: number[];
  }
  ```

- [ ] **Step 2:** Add `colorMatrix?: number[]` to `GroupDrawCommand`:
  ```ts
  export interface GroupDrawCommand {
    kind: 'group';
    transform?: Mat3;
    alpha?: number;
    /**
     * Optional 4×5 color matrix (row-major, 20 numbers) applied to every
     * fragment in this group's subtree. Format matches SVG feColorMatrix:
     *   out = M₄ₓ₄ * in + bias
     * where bias is column 4 (indices 4,9,14,19).
     *
     * Accumulated multiplicatively down the group stack — inner group's
     * matrix is applied after the outer group's. Defaults to identity.
     */
    colorMatrix?: number[];
    children: DrawCommand[];
  }
  ```

- [ ] **Step 3:** Run `pnpm typecheck` (or `tsc --noEmit`) from `packages/weasel-gl/`. Expect clean.

**No test file changes for this task** — the types are structural; correctness is verified by downstream tests.

---

## Task 2: Extend path-fill shaders with vertex-color variant and color-matrix uniforms

**Files:** `src/shaders/pathFill.ts`

> Convention §2: every fragment shader outputs `vec4(rgb * a, a)` (premultiplied). The color-matrix transform is applied to the straight-alpha SRC color before premultiplication. Add the standard top-of-file comment.

This task produces two exported shader pairs: the existing flat variant (renamed `VERT_SRC` / `FRAG_SRC` stays; the new behavior added) and a new vertex-color variant (`VCOLOR_VERT_SRC` / `VCOLOR_FRAG_SRC`).

Both variants gain `u_colorMatrix` (mat4) and `u_colorBias` (vec4) uniforms. The identity path is fast — identity matrix multiply is just a pass-through; the compiler folds it efficiently when the uniform value is identity, but we don't bother with a `u_useColorMatrix` flag since the overhead is negligible and adding a flag would complicate the draw path.

- [ ] **Step 1:** Update `FRAG_SRC` (flat variant) to add color-matrix support. Replace the existing `FRAG_SRC`:

  ```glsl
  // pathFill.ts — flat variant fragment shader
  // Premultiplied output per conventions §2.
  // u_colorMatrix / u_colorBias default to identity / zero when color matrix
  // is unused. Applied to straight-alpha color before premultiplication.
  #version 300 es
  precision highp float;
  uniform vec4 u_color;
  uniform float u_alpha;
  uniform mat4 u_colorMatrix;
  uniform vec4 u_colorBias;
  out vec4 outColor;
  void main() {
    vec4 src = u_color;
    vec4 mapped = u_colorMatrix * src + u_colorBias;
    mapped = clamp(mapped, 0.0, 1.0);
    float a = mapped.a * u_alpha;
    outColor = vec4(mapped.rgb * a, a);
  }
  ```

- [ ] **Step 2:** Add `VCOLOR_VERT_SRC` — vertex shader for the vertex-color variant. Passes `a_vertexColor` through as a varying:

  ```glsl
  // pathFill.ts — vertex-color variant vertex shader
  #version 300 es
  in vec2 a_position;
  in vec4 a_vertexColor;
  uniform mat3 u_proj;
  uniform mat3 u_model;
  out vec4 v_vertexColor;
  void main() {
    vec3 screen = u_model * vec3(a_position, 1.0);
    vec3 clip = u_proj * vec3(screen.xy, 1.0);
    gl_Position = vec4(clip.xy, 0.0, 1.0);
    v_vertexColor = a_vertexColor;
  }
  ```

- [ ] **Step 3:** Add `VCOLOR_FRAG_SRC` — fragment shader for the vertex-color variant. Multiplies `v_vertexColor` with `u_color` before applying the color matrix:

  ```glsl
  // pathFill.ts — vertex-color variant fragment shader
  // Per-vertex color is multiplied with u_color (component-wise) to produce
  // the tinted source. Color matrix is applied after. Premultiplied output.
  #version 300 es
  precision highp float;
  in vec4 v_vertexColor;
  uniform vec4 u_color;
  uniform float u_alpha;
  uniform mat4 u_colorMatrix;
  uniform vec4 u_colorBias;
  out vec4 outColor;
  void main() {
    vec4 src = u_color * v_vertexColor;
    vec4 mapped = u_colorMatrix * src + u_colorBias;
    mapped = clamp(mapped, 0.0, 1.0);
    float a = mapped.a * u_alpha;
    outColor = vec4(mapped.rgb * a, a);
  }
  ```

- [ ] **Step 4:** Update the exported constant arrays:

  ```ts
  /** Uniforms for BOTH flat and vertex-color path-fill variants. */
  export const PATH_FILL_UNIFORMS = [
    'u_proj', 'u_model', 'u_color', 'u_alpha', 'u_colorMatrix', 'u_colorBias',
  ] as const;

  /** Attributes for the flat (no vertex-color) variant. */
  export const PATH_FILL_ATTRIBUTES = ['a_position'] as const;

  /** Attributes for the vertex-color variant. */
  export const PATH_FILL_VCOLOR_ATTRIBUTES = ['a_position', 'a_vertexColor'] as const;
  ```

- [ ] **Step 5:** Run `pnpm typecheck`. Expect clean (shader sources are strings; type errors only come from TS exports).

**No unit test for shader GLSL text** — the fragment's correctness is confirmed by the Playwright smoke in Task 10 (convention §1: mock GL recorder doesn't verify color output).

---

## Task 3: Extend GroupState with color matrix stack

**Files:** `src/GroupState.ts`, `src/GroupState.test.ts`

> Convention §9: color matrix state is per-renderer stack state, not shared across renderers via any registry.

The 4×5 color matrix identity is `[1,0,0,0,0, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]`.

- [ ] **Step 1:** Add a `compose4x5` helper (module-private) and export `identityColorMatrix`:

  ```ts
  /** Row-major 4×5 color matrix identity. */
  export const IDENTITY_COLOR_MATRIX = new Float32Array([
    1,0,0,0,0,
    0,1,0,0,0,
    0,0,1,0,0,
    0,0,0,1,0,
  ]);

  /**
   * Compose two 4×5 color matrices: out = outer ∘ inner
   * (inner applied first, then outer).
   *
   * Math: given outer maps x → M_o*x + b_o and inner maps x → M_i*x + b_i:
   *   composed(x) = M_o*(M_i*x + b_i) + b_o
   *               = (M_o*M_i)*x + (M_o*b_i + b_o)
   *
   * Each matrix is row-major [r0c0..r0c4, r1c0..r1c4, r2c0..r2c4, r3c0..r3c4].
   * The 4×4 portion occupies indices [0..3, 5..8, 10..13, 15..18].
   * The bias column occupies indices [4, 9, 14, 19].
   */
  function compose4x5(outer: Float32Array, inner: Float32Array): Float32Array {
    const result = new Float32Array(20);
    // 4×4 matrix multiply: outer.M * inner.M
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += outer[row * 5 + k] * inner[k * 5 + col];
        }
        result[row * 5 + col] = sum;
      }
      // bias: outer.M * inner.bias + outer.bias
      let biasSum = outer[row * 5 + 4]; // outer.bias[row]
      for (let k = 0; k < 4; k++) {
        biasSum += outer[row * 5 + k] * inner[k * 5 + 4];
      }
      result[row * 5 + 4] = biasSum;
    }
    return result;
  }
  ```

- [ ] **Step 2:** Add `colorMatrixStack` to `GroupState` and extend `GroupFrame`:

  ```ts
  export interface GroupFrame {
    transform?: Mat3;
    alpha?: number;
    /** Row-major 4×5 color matrix (20 floats). Absent = identity; no change to stack. */
    colorMatrix?: Float32Array | number[];
  }

  export class GroupState {
    private transformStack: Mat3[] = [mat3.identity()];
    private alphaStack: number[] = [1];
    private colorMatrixStack: Float32Array[] = [IDENTITY_COLOR_MATRIX];

    // ... existing transform / alpha getters unchanged ...

    get colorMatrix(): Float32Array {
      return this.colorMatrixStack[this.colorMatrixStack.length - 1];
    }

    push(frame: GroupFrame): void {
      // ... existing transform + alpha composition unchanged ...
      const nextCM = frame.colorMatrix
        ? compose4x5(
            this.colorMatrix,
            frame.colorMatrix instanceof Float32Array
              ? frame.colorMatrix
              : new Float32Array(frame.colorMatrix),
          )
        : this.colorMatrix;
      this.colorMatrixStack.push(nextCM);
    }

    pop(): void {
      if (this.transformStack.length <= 1) {
        throw new Error('GroupState.pop: cannot pop root frame');
      }
      this.transformStack.pop();
      this.alphaStack.pop();
      this.colorMatrixStack.pop();
    }
  }
  ```

- [ ] **Step 3:** Write unit tests in `GroupState.test.ts` (add below existing tests):

  ```ts
  describe('GroupState — colorMatrix', () => {
    it('starts at identity colorMatrix', () => {
      const s = new GroupState();
      expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
    });

    it('push with no colorMatrix leaves colorMatrix unchanged', () => {
      const s = new GroupState();
      s.push({ alpha: 0.5 });
      expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
    });

    it('push with identity colorMatrix produces identity', () => {
      const s = new GroupState();
      s.push({ colorMatrix: IDENTITY_COLOR_MATRIX });
      expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
    });

    it('pop() after colorMatrix push restores identity', () => {
      const s = new GroupState();
      // Negate-red matrix: [−1,0,0,0,1, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]
      const negR = new Float32Array([-1,0,0,0,1, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
      s.push({ colorMatrix: negR });
      s.pop();
      expect(Array.from(s.colorMatrix)).toEqual(Array.from(IDENTITY_COLOR_MATRIX));
    });

    it('compose4x5: outer bias is added', () => {
      // Matrix that adds (0.1, 0, 0, 0) bias
      const addR = new Float32Array([1,0,0,0,0.1, 0,1,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
      const s = new GroupState();
      s.push({ colorMatrix: addR });
      s.push({ colorMatrix: addR });
      // Composed bias should be 0.2 for R
      expect(s.colorMatrix[4]).toBeCloseTo(0.2, 5);
    });

    it('compose4x5: nested matrices compose in correct order (inner first)', () => {
      // Swap R and G: [0,1,0,0,0, 1,0,0,0,0, 0,0,1,0,0, 0,0,0,1,0]
      const swapRG = new Float32Array([0,1,0,0,0, 1,0,0,0,0, 0,0,1,0,0, 0,0,0,1,0]);
      // Swap G and B: [1,0,0,0,0, 0,0,1,0,0, 0,1,0,0,0, 0,0,0,1,0]
      const swapGB = new Float32Array([1,0,0,0,0, 0,0,1,0,0, 0,1,0,0,0, 0,0,0,1,0]);
      const s = new GroupState();
      s.push({ colorMatrix: swapRG }); // outer
      s.push({ colorMatrix: swapGB }); // inner — applied first
      // Input (R,G,B) → inner swapGB → (R,B,G) → outer swapRG → (B,R,G)
      // So composed row 0 should be [0,0,1,0,0] (takes B)
      expect(s.colorMatrix[0]).toBeCloseTo(0, 5); // R from row 0
      expect(s.colorMatrix[1]).toBeCloseTo(0, 5); // G from row 0
      expect(s.colorMatrix[2]).toBeCloseTo(1, 5); // B from row 0
    });
  });
  ```

- [ ] **Step 4:** Run `pnpm test` in `packages/weasel-gl/`. All existing tests pass; new GroupState colorMatrix tests pass.

---

## Task 4: Extend WeaselRenderer with pathFillVColor program

**Files:** `src/WeaselRenderer.ts`

> Convention §9: each renderer compiles its own programs. No shared program objects across renderers.

- [ ] **Step 1:** Import the new shader exports:

  ```ts
  import {
    VERT_SRC,
    FRAG_SRC,
    VCOLOR_VERT_SRC,
    VCOLOR_FRAG_SRC,
    PATH_FILL_UNIFORMS,
    PATH_FILL_ATTRIBUTES,
    PATH_FILL_VCOLOR_ATTRIBUTES,
  } from './shaders/pathFill';
  ```

- [ ] **Step 2:** Add `pathFillVColor: ShaderProgram` field and compile in constructor:

  ```ts
  private pathFillFlat: ShaderProgram;   // renamed from pathFill for clarity
  private pathFillVColor: ShaderProgram;
  ```

  In constructor, after compiling `pathFillFlat`:
  ```ts
  this.pathFillVColor = new ShaderProgram(this.gl, VCOLOR_VERT_SRC, VCOLOR_FRAG_SRC);
  this.pathFillVColor.lookupUniforms(PATH_FILL_UNIFORMS);
  this.pathFillVColor.lookupAttributes(PATH_FILL_VCOLOR_ATTRIBUTES);
  ```

  Rename `this.pathFill` → `this.pathFillFlat` throughout the file. The `GLMeshCache` is constructed with `this.pathFillFlat.attribute('a_position')` as before.

- [ ] **Step 3:** Mirror in `onContextRestored()`:

  ```ts
  this.pathFillFlat = new ShaderProgram(this.gl, VERT_SRC, FRAG_SRC);
  this.pathFillFlat.lookupUniforms(PATH_FILL_UNIFORMS);
  this.pathFillFlat.lookupAttributes(PATH_FILL_ATTRIBUTES);
  this.pathFillVColor = new ShaderProgram(this.gl, VCOLOR_VERT_SRC, VCOLOR_FRAG_SRC);
  this.pathFillVColor.lookupUniforms(PATH_FILL_UNIFORMS);
  this.pathFillVColor.lookupAttributes(PATH_FILL_VCOLOR_ATTRIBUTES);
  ```

- [ ] **Step 4:** Expose `pathFillVColor` on `DrawContext` and update `render()`:

  ```ts
  // draw.ts DrawContext gains:
  pathFillFlat: ShaderProgram;
  pathFillVColor: ShaderProgram;
  // (remove old pathFill field)
  ```

  In `WeaselRenderer.render()`:
  ```ts
  const ctx: DrawContext = {
    gl,
    pathFillFlat: this.pathFillFlat,
    pathFillVColor: this.pathFillVColor,
    textSdf: this.textSdf,
    meshCache: this.meshCache,
    textureCache: this.textureCache,
    state: this.groupState,
    widthCss: this.widthCss,
    heightCss: this.heightCss,
  };
  ```

- [ ] **Step 5:** Update `_pathFill()` internal accessor to `_pathFillFlat()` and add `_pathFillVColor()` for test access.

- [ ] **Step 6:** Run `pnpm typecheck`. Fix any references to the old `ctx.pathFill` in `draw.ts`.

---

## Task 5: Upload color-matrix uniforms helper

**Files:** `src/draw.ts`

This task introduces a shared helper used by all path-draw variants. It reads `ctx.state.colorMatrix` (the cumulative 4×5 from GroupState) and uploads `u_colorMatrix` (mat4) and `u_colorBias` (vec4).

- [ ] **Step 1:** Add `setColorMatrixUniforms` helper in `draw.ts`:

  ```ts
  /**
   * Upload the current cumulative color matrix from GroupState.
   *
   * The GroupState holds a row-major 4×5 Float32Array. GL expects mat4 in
   * column-major order. Extraction: the 4×4 portion occupies indices
   * [row*5 + col] for row,col in 0..3; we transpose to column-major.
   *
   * u_colorBias is column 4: indices [4, 9, 14, 19].
   */
  function setColorMatrixUniforms(ctx: DrawContext, prog: ShaderProgram): void {
    const gl = ctx.gl;
    const cm = ctx.state.colorMatrix; // 4×5 row-major Float32Array, length 20

    // Extract 4×4 portion and convert to column-major for uniformMatrix4fv.
    const m4 = new Float32Array(16);
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        m4[col * 4 + row] = cm[row * 5 + col];
      }
    }
    gl.uniformMatrix4fv(prog.uniform('u_colorMatrix')!, false, m4);

    // Bias: column 4 of the 4×5 matrix.
    gl.uniform4f(
      prog.uniform('u_colorBias')!,
      cm[4], cm[9], cm[14], cm[19],
    );
  }
  ```

- [ ] **Step 2:** Call `setColorMatrixUniforms` after `setProjAndModel` in `drawPathFillSolid`, `drawPathFillStencil`, and the new `drawPathFillVColor` functions (Tasks 6 and 7). Do not call it in `drawText` — the text SDF shader doesn't receive color-matrix uniforms in step 5 (text is outside the color-matrix scope for now; add a TODO comment).

- [ ] **Step 3:** Run `pnpm typecheck`. Expect clean if DrawContext was updated in Task 4.

---

## Task 6: Extend drawGroup to push color matrix

**Files:** `src/draw.ts`

- [ ] **Step 1:** Update `drawGroup` to pass `colorMatrix` to `GroupState.push()`:

  ```ts
  function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
    ctx.state.push({
      transform: cmd.transform,
      alpha: cmd.alpha,
      colorMatrix: cmd.colorMatrix
        ? new Float32Array(cmd.colorMatrix)
        : undefined,
    });
    for (const child of cmd.children) dispatch(ctx, child);
    ctx.state.pop();
  }
  ```

- [ ] **Step 2:** Add unit test in `draw.test.ts` asserting that a group with `colorMatrix` causes the mock GL recorder to receive `uniformMatrix4fv` and `uniform4f` calls for `u_colorMatrix` and `u_colorBias` when a child path is drawn. Use a simple non-identity matrix (e.g., the red-channel-only matrix `[1,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,1,0]`) and assert the correct column-major 4×4 upload.

  Test structure:
  ```ts
  it('group with colorMatrix uploads non-identity colorMatrix uniform for child path', () => {
    const recorder = makeGLRecorder();
    // build DrawContext with recorder gl, pathFillFlat, identity groupState, etc.
    // ...
    const redChannelOnly = [1,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,0,0,1,0];
    const cmd: GroupDrawCommand = {
      kind: 'group',
      colorMatrix: redChannelOnly,
      children: [{ kind: 'path', path: FIXTURE_PATH, fill: { color: '#ff0000' } }],
    };
    dispatch(ctx, cmd);
    const m4fCalls = recorder.calls.filter(c => c.method === 'uniformMatrix4fv');
    // At least one call targeting u_colorMatrix location
    expect(m4fCalls.length).toBeGreaterThan(0);
  });
  ```

- [ ] **Step 3:** Run `pnpm test`. All tests pass.

---

## Task 7: Extend drawPath for vertex colors

**Files:** `src/draw.ts`

> Convention §8: vertex position (and color attribute) correctness can't be confirmed by the mock GL recorder. Playwright smoke in Task 10 confirms this path works correctly in a real browser.

- [ ] **Step 1:** Add `drawPathFillVColor` function. It follows the same structure as `drawPathFillSolid` but:
  1. Uses `ctx.pathFillVColor` program.
  2. After uploading the geometry VBO (from `meshCache.handleFor(mesh).vao`), creates a separate per-draw color VBO and binds it as `a_vertexColor` (location 1).
  3. Calls `setColorMatrixUniforms` after `setProjAndModel`.

  ```ts
  function drawPathFillVColor(
    ctx: DrawContext,
    cmd: PathDrawCommand,
    fill: NonNullable<PathDrawCommand['fill']>,
    handle: GLMeshHandle,
  ): void {
    const gl = ctx.gl;
    const prog = ctx.pathFillVColor;
    gl.useProgram(prog.handle);
    gl.bindVertexArray(handle.vao);
    setProjAndModel(ctx, prog);
    setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
    setColorMatrixUniforms(ctx, prog);

    // Per-draw vertex-color VBO. TODO(step 7): pool these buffers.
    const colorVbo = gl.createBuffer();
    if (!colorVbo) throw new Error('drawPathFillVColor: createBuffer (color VBO) returned null');
    const aVColorLoc = prog.attribute('a_vertexColor');
    if (aVColorLoc !== undefined) {
      gl.bindBuffer(gl.ARRAY_BUFFER, colorVbo);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array(cmd.vertexColors!),
        gl.DYNAMIC_DRAW,
      );
      gl.enableVertexAttribArray(aVColorLoc);
      gl.vertexAttribPointer(aVColorLoc, 4, gl.FLOAT, false, 0, 0);
    }

    gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
    gl.bindVertexArray(null);
  }
  ```

- [ ] **Step 2:** Update `drawPath` to select variant and call `setColorMatrixUniforms` for the flat variant too:

  ```ts
  function drawPath(ctx: DrawContext, cmd: PathDrawCommand): void {
    if (!cmd.fill && !cmd.stroke) return;

    if (cmd.fill) {
      const mesh = getMesh(cmd.path);
      const handle = ctx.meshCache.handleFor(mesh);

      if (cmd.vertexColors) {
        // Vertex-color variant — geometry coverage check in Playwright smoke
        // (convention §8).
        drawPathFillVColor(ctx, cmd, cmd.fill, handle);
      } else if (handle.requiresStencil) {
        drawPathFillStencil(ctx, cmd.fill, handle);
      } else {
        drawPathFillSolid(ctx, cmd.fill, handle);
      }
    }

    if (cmd.stroke) {
      drawPathStroke(ctx, cmd);
    }
  }
  ```

- [ ] **Step 3:** Update `drawPathFillSolid` and `drawPathFillStencil` to call `setColorMatrixUniforms` (using `ctx.pathFillFlat`). Replace all `ctx.pathFill` references with `ctx.pathFillFlat`.

- [ ] **Step 4:** Add unit test in `draw.test.ts` asserting that a path with `vertexColors` causes a `bufferData` call with the color data. Use the mock GL recorder.

  ```ts
  it('path with vertexColors uploads a_vertexColor buffer', () => {
    // build ctx with recorder...
    const vertexColors = [1,0,0,1, 0,1,0,1, 0,0,1,1]; // 3 vertices
    const cmd: PathDrawCommand = {
      kind: 'path',
      path: FIXTURE_PATH,
      fill: { color: '#ffffff' },
      vertexColors,
    };
    dispatch(ctx, cmd);
    const bufferDataCalls = recorder.calls.filter(c => c.method === 'bufferData');
    // One call should have Float32Array matching vertexColors
    const colorUpload = bufferDataCalls.find(c =>
      c.args[1] instanceof Float32Array &&
      Array.from(c.args[1] as Float32Array).slice(0, 3).every((v, i) => v === vertexColors[i])
    );
    expect(colorUpload).toBeDefined();
  });
  ```

- [ ] **Step 5:** Run `pnpm test`. All tests pass.

---

## Task 8: Validate vertex count at draw time

**Files:** `src/draw.ts`

Missing or mismatched `vertexColors` arrays are a footgun: wrong length silently produces garbage colors. Add a dev-mode assertion.

- [ ] **Step 1:** Add a validation check in `drawPathFillVColor`:

  ```ts
  // Before the color VBO upload:
  const mesh = handle; // alias for clarity
  const expectedLength = (mesh.indexCount / 3) * 4; // rough upper bound check
  // Exact vertex count: derive from the geometry VBO. In practice, weasel-gl
  // stores vertexCount on GLMeshHandle if convenient; for now we check that
  // vertexColors.length is a positive multiple of 4.
  if (cmd.vertexColors!.length % 4 !== 0) {
    console.warn(
      `weasel-gl drawPath: vertexColors.length=${cmd.vertexColors!.length} is not a multiple of 4 ` +
      `(expected 4 × vertexCount). Skipping vertex-color upload.`
    );
    // Fall back to flat draw.
    drawPathFillSolid(ctx, cmd.fill!, handle);
    return;
  }
  ```

  Note: precise vertex-count validation requires `GLMeshHandle` to expose `vertexCount`. Add `vertexCount: number` to the `GLMeshHandle` interface in `GLMeshCache.ts` and set it in `upload()` as `mesh.vertices.length / 2` (since vertices is float32, 2 floats per vertex). This is a small `GLMeshCache` extension.

- [ ] **Step 2:** Update `GLMeshCache.ts`: add `vertexCount: number` to `GLMeshHandle`, set in `upload()`.

- [ ] **Step 3:** Update the validation to use exact count:

  ```ts
  const expectedLength = handle.vertexCount * 4;
  if (cmd.vertexColors!.length !== expectedLength) {
    console.warn(
      `weasel-gl drawPath: vertexColors.length=${cmd.vertexColors!.length} ` +
      `but tessellated mesh has ${handle.vertexCount} vertices ` +
      `(expected ${expectedLength}). Skipping vertex-color upload.`
    );
    drawPathFillSolid(ctx, cmd.fill!, handle);
    return;
  }
  ```

- [ ] **Step 4:** Add unit test for the validation warning (use `vi.spyOn(console, 'warn')`).

- [ ] **Step 5:** Run `pnpm test`. All tests pass.

---

## Task 9: Update index.ts exports

**Files:** `src/index.ts`

- [ ] **Step 1:** Update the barrel comment to mention step 5 scope.

- [ ] **Step 2:** Export `IDENTITY_COLOR_MATRIX` and `GroupFrame` type from `GroupState`:

  ```ts
  export { GroupState, type GroupFrame, IDENTITY_COLOR_MATRIX } from './GroupState';
  ```

  This lets consumers build color matrices from the identity constant.

- [ ] **Step 3:** The `PathDrawCommand` and `GroupDrawCommand` types are already re-exported via the existing `DrawCommand.ts` re-export block; no additional exports needed for the new optional fields.

- [ ] **Step 4:** Run `pnpm typecheck`. Expect clean.

---

## Task 10: Playwright smoke specs

**Files:**
- `dev/vertex-colors.html` + `dev/vertex-colors.ts` + `dev/vertex-colors.spec.ts`
- `dev/color-matrix.html` + `dev/color-matrix.ts` + `dev/color-matrix.spec.ts`

> Convention §1: mock GL recorder doesn't verify color output. Playwright smoke is required for visual correctness of both features.
> Convention §6: `preserveDrawingBuffer: true` AND `stencil: true` in every test dev-page `getContext` call.
> Convention §1 (step-3 update): use **16×16 grid sampling**, not diagonal. A gradient strip and a hue-rotated region may occupy only part of the canvas.

### Vertex-colors smoke scene

The scene draws a red-to-blue gradient across a convex quad (two triangles). Four vertices: top-left, top-right, bottom-left, bottom-right. Vertex colors: `[1,0,0,1, 0,0,1,1, 1,0,0,1, 0,0,1,1]` (left = red, right = blue). The path is an open polygon with these four points.

`vertex-colors.ts`:
- Canvas 400×200, DPR 1.
- `getContext('webgl2', { preserveDrawingBuffer: true, stencil: true })`.
- Build a `PathDrawCommand` for the quad with `fill: { color: '#ffffff' }` and the vertex colors array above.
- Render.

`vertex-colors.spec.ts` assertions:
- Sample pixels in a 4×4 sub-grid on the left quarter of the canvas: expect red channel > 0.8 and blue channel < 0.2.
- Sample pixels in a 4×4 sub-grid on the right quarter: expect blue channel > 0.8 and red channel < 0.2.
- Sample pixels near the center: expect red and blue channels both in range 0.3–0.7 (the gradient midpoint).

### Color-matrix smoke scene

The scene draws two identical red circles (solid fill `#ff0000`) side-by-side. The right one is wrapped in a group with a hue-rotation colorMatrix that converts red to green (approximately; exact matrix below). The canvas is 400×200.

Hue-rotate 120° matrix (from CSS/SVG specification, in row-major 4×5, bias column all zero):

```ts
// Hue-rotate 120° — standard SVG feColorMatrix hueRotate formula
// Approximation adequate for the smoke test; exact values from CSS filter spec:
const cosH = Math.cos(2 * Math.PI / 3); // cos(120°) ≈ -0.5
const sinH = Math.sin(2 * Math.PI / 3); // sin(120°) ≈  0.866
const hueRotate120: number[] = [
  0.213 + cosH*0.787 - sinH*0.213,
  0.715 - cosH*0.715 - sinH*0.715,
  0.072 - cosH*0.072 + sinH*0.928,
  0, 0,

  0.213 - cosH*0.213 + sinH*0.143,
  0.715 + cosH*0.285 + sinH*0.140,
  0.072 - cosH*0.072 - sinH*0.283,
  0, 0,

  0.213 - cosH*0.213 - sinH*0.787,
  0.715 - cosH*0.715 + sinH*0.715,
  0.072 + cosH*0.928 + sinH*0.072,
  0, 0,

  0, 0, 0, 1, 0,
];
```

A red input `(1,0,0,1)` through this matrix produces approximately `(0,0.5,0.866,1)` — the green and blue channels should both be non-trivial, with green > red.

`color-matrix.spec.ts` assertions:
- Left circle (no color matrix): sample center pixels and expect red channel > 0.8, green channel < 0.1.
- Right circle (hue-rotated group): sample center pixels and expect green channel > red channel (green is boosted, red is suppressed).

- [ ] **Step 1:** Create `dev/vertex-colors.html` — minimal HTML with a single canvas element and a `<script type="module">` importing `./vertex-colors.ts`.

- [ ] **Step 2:** Create `dev/vertex-colors.ts` — the vertex-color gradient scene (as described above).

- [ ] **Step 3:** Create `dev/vertex-colors.spec.ts` — Playwright spec with grid-sampling assertions.

- [ ] **Step 4:** Create `dev/color-matrix.html` — same minimal HTML for the color-matrix scene.

- [ ] **Step 5:** Create `dev/color-matrix.ts` — the two-circle scene with hue-rotate 120° on the right group.

- [ ] **Step 6:** Create `dev/color-matrix.spec.ts` — Playwright spec with left/right circle assertions.

- [ ] **Step 7:** Run `pnpm test:smoke` (or `npx playwright test` from `packages/weasel-gl/`) and confirm both smoke specs pass. If a spec fails, diagnose whether the issue is in the shader GLSL (wrong output channel), the color-matrix upload (row/column major mismatch), or the vertex-color VBO binding order.

---

## Task 11: Validate context restore path

**Files:** `src/WeaselRenderer.ts` (already modified in Task 4)

> Convention §1: context-loss handling is a v1 correctness requirement. Both new programs must re-compile correctly on restore.

- [ ] **Step 1:** Confirm `onContextRestored` re-compiles both `pathFillFlat` and `pathFillVColor` and calls `lookupUniforms(PATH_FILL_UNIFORMS)` on both. (Should be done already in Task 4, Step 3 — this task is a checklist confirmation.)

- [ ] **Step 2:** Add a unit test for context restore in `WeaselRenderer.test.ts` that simulates a context-loss/restore cycle and confirms the renderer can still render a path-with-vertexColors command after restoration. Use the existing `WEBGL_lose_context` extension mock pattern from the step-1 test suite.

  ```ts
  it('re-compiles pathFillVColor program after context restore', () => {
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl as unknown as WebGL2RenderingContext, width: 100, height: 100, dpr: 1 });
    // Simulate context loss + restore
    r._onContextRestored(); // expose via @internal accessor or test-only subclass
    // Attempt a render with vertexColors — should not throw
    expect(() => r.render([{
      kind: 'path',
      path: FIXTURE_PATH,
      fill: { color: '#ff0000' },
      vertexColors: [1,0,0,1, 0,0,1,1, 1,0,0,1],
    }])).not.toThrow();
  });
  ```

- [ ] **Step 3:** Run `pnpm test`. All tests pass.

---

## Task 12: Done note + barrel comment update

**Files:** `src/index.ts`, `docs/superpowers/plans/2026-05-09-webgl-step-5-done.md`

- [ ] **Step 1:** Update the `index.ts` barrel comment: "Through step 5: … per-vertex colors (PathDrawCommand.vertexColors), color matrix group attribute (GroupDrawCommand.colorMatrix)."

- [ ] **Step 2:** Write the done note at `docs/superpowers/plans/2026-05-09-webgl-step-5-done.md`. Template:

  ```md
  # WebGL Step 5 — Done

  **Plan:** `2026-05-09-webgl-step-5-vertex-colors-and-color-matrix.md`
  **Date completed:** [fill in]

  ## What shipped
  [list]

  ## Notable deviations from plan
  [list, or "None"]

  ## Test results
  - Vitest: N tests pass (N from previous steps, N new).
  - Playwright: N/N smoke specs pass.
  - Typecheck: clean.

  ## Lessons for step 6 and beyond
  [list any new convention-worthy lessons]

  ## Open follow-ups
  - Per-vertex colors on stroke ribbon geometry — deferred.
  - Buffer pooling for per-draw vertex-color VBOs — deferred to step 7.
  - Color matrix on text DrawCommands — not in scope.
  ```

---

## Expected test count delta

- GroupState.test.ts: +6 tests (colorMatrix stack)
- draw.test.ts: +2 tests (colorMatrix uniform upload, vertex-color VBO upload)
- GLMeshCache.test.ts: +1 test (vertexCount field)
- WeaselRenderer.test.ts: +1 test (context-restore re-compiles pathFillVColor)
- vertex-colors.spec.ts: 1 new Playwright spec (~3 assertions)
- color-matrix.spec.ts: 1 new Playwright spec (~4 assertions)

**Total vitest delta: ~10 new unit tests. Total Playwright delta: 2 new smoke specs.**

---

## Inline-vs-subagent split recommendation

Per convention §7: tasks whose code is fully spelled out in this plan (Tasks 1, 2, 3 Step 1, 5, 6 Step 1, 9) are suitable for inline execution. Tasks requiring judgment (Task 7 — vertex VBO binding order and attribute location, Task 10 — Playwright smoke scene construction and pixel-sampling coordinates) benefit from a subagent. Estimated split: 65% inline, 35% subagent.
