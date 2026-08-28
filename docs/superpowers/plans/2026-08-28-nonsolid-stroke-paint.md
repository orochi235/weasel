# Non-Solid Stroke Paint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the renderer paint a gradient or pattern stroke instead of throwing, fixing a live crash on any SVG import that carries `stroke="url(#grad)"` on a shape.

**Architecture:** Split each `drawPathFill*` into a *bind* half (program + uniforms + texture) and a *draw* half (`applyClipTest` + `drawElements`), so a caller that owns its own stencil state can bind paint without having its stencil test clobbered. Then route both stroke paths — the plain ribbon and the inner/outer stencilled one — through that seam, and delete the throw.

**Tech Stack:** TypeScript, WebGL2, vitest. Renderer unit tests drive a proxy-recording GL context (`makeGLRecorder`), not real GL.

**Spec:** `docs/superpowers/specs/2026-08-27-paint-editor-design.md`, Arc 1.

---

## Background the implementer needs

`Stroke.paint` is a full `FillStyle` (`packages/core/src/core/paint-types.ts:130`). SVG import already puts gradients there deliberately — `strokeDataFromSvg` (`packages/svg/src/unpack.ts:113`), with a test asserting it (`packages/svg/src/unpack.test.ts:210`). `strokeInPoseFrame` (`packages/core/src/canvas/NodeShape.ts:480`) bakes any paint through untouched. Then `drawPathStroke` throws.

Gradient-stroked **text** already works, because `drawTextOutlineGroup` routes its ribbon through `drawPathFillByKind` (`packages/core/src/renderer/draw.ts:1317`). That call is the model for this whole change.

**The trap that shapes the design.** `applyClipTest` (`draw.ts:871`) does `gl.disable(gl.STENCIL_TEST)` when `clipDepth === 0`, and otherwise sets `stencilFunc` to the ancestor clip mask alone. Every `drawPathFill*` calls it just before drawing. `drawPathStrokeStenciled` (`draw.ts:1112`) sets up its *own* stencil test to clip the doubled ribbon to one side of the silhouette — so calling `drawPathFillByKind` inside it would wipe that test out and paint the full doubled ribbon. Nothing would fail; the stroke would just be twice as wide and centred. Hence the bind/draw split rather than a direct call.

**Ordering is free if you copy `drawPathFill`.** `tryStageSolid(ctx, mesh, undefined)` flushes the staged solid run and returns `false` (`draw.ts:586-597`), so passing `undefined` for a non-solid paint drains the batch before you draw. Do not hand-roll a `flushSolids`.

---

## File Structure

- **Modify:** `packages/core/src/renderer/draw.ts` — the only production file that changes.
  - `drawPathFillSolid` / `drawPathFillGradient` / `drawPathFillPattern` split into bind + draw.
  - `drawPathFillByKind` becomes a thin bind-then-draw composition.
  - `drawPathStroke` loses the throw; `drawPathStrokeUnclipped` and `drawPathStrokeStenciled` gain a non-solid route.
  - `drawPathFillStencil` (`:980`) loses its black fallback.
- **Create:** `packages/core/src/renderer/draw.strokePaint.test.ts` — the whole arc's coverage, modelled on `draw.strokeAlign.test.ts`.
- **Create:** `.changeset/<name>.md` — `patch`, per `CLAUDE.md`.

---

## Task 1: A failing test for the crash

**Files:**
- Create: `packages/core/src/renderer/draw.strokePaint.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
/**
 * A stroke's paint is a full `FillStyle`. SVG import puts gradients there
 * deliberately, so the renderer has to paint one rather than refuse it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import type { PolygonPath, Stroke, FillStyle } from '@weasel-js/core';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { _resetStrokeMeshCacheForTests } from './cache/strokeMeshCache';

const M = 0, L = 1;

function horizontalLine(): PolygonPath {
  return {
    kind: 'polygon',
    commands: new Uint8Array([M, L, L]),
    coords: new Float32Array([0, 0, 100, 0, 200, 0]),
    fillRule: 'nonzero',
  };
}

const GRADIENT: FillStyle = {
  fill: 'linear-gradient',
  from: { x: 0, y: 0 },
  to: { x: 200, y: 0 },
  stops: [{ offset: 0, color: '#ff0000' }, { offset: 1, color: '#0000ff' }],
  units: 'local',
};

type Recorder = ReturnType<typeof makeGLRecorder>;

describe('renderer — non-solid stroke paint', () => {
  let recorder: Recorder;
  let r: WeaselRenderer;

  beforeEach(() => {
    _resetStrokeMeshCacheForTests();
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
  });

  const render = (stroke: Stroke): void => {
    recorder.reset();
    r.render([{ kind: 'path', path: horizontalLine(), stroke } as DrawCommand]);
  };

  it('paints a gradient stroke instead of throwing', () => {
    expect(() => render({ width: 10, paint: GRADIENT })).not.toThrow();
  });

  it('paints a gradient stroke on an inner-aligned polygon instead of throwing', () => {
    expect(() => render({ width: 10, align: 'inner', paint: GRADIENT })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm both fail for the stated reason**

Run: `npx vitest run --project=kit packages/core/src/renderer/draw.strokePaint.test.ts`

Expected: 2 failed, each with `weasel step 2: stroke.paint must be solid; gradient/pattern arrives in step 5+`.

If they pass, stop — the premise of this plan is wrong and the throw has already been removed.

- [ ] **Step 3: Commit the failing test**

```bash
git add packages/core/src/renderer/draw.strokePaint.test.ts
git commit -m "cover the gradient stroke the renderer refuses to paint"
```

---

## Task 2: Split the fill draws into bind and draw

Pure refactor. No behavior change, and every existing renderer test must stay green.

**Files:**
- Modify: `packages/core/src/renderer/draw.ts:720-800` (the three `drawPathFill*` and their dispatcher)

- [ ] **Step 1: Extract the bind half of each kind**

Replace `drawPathFillByKind` and the three draw functions with a bind/draw pair each. The bind half does everything up to and including uniform and texture setup, and returns the `ShaderProgram` it bound so the caller can reach `prog.attribute(...)`. It must **not** call `applyClipTest`, bind a VAO, or draw.

```ts
/**
 * Bind the program, uniforms and textures for `fill`, and return the program.
 *
 * Split from the draw so a caller owning its own stencil state can paint
 * without `applyClipTest` clobbering it — `drawPathStrokeStenciled` clips a
 * doubled ribbon to one side of the silhouette, and `applyClipTest` at depth 0
 * disables the stencil test outright.
 *
 * Returns `null` when the paint cannot be bound at all (an unregistered
 * pattern texture), meaning the caller should skip the draw entirely.
 */
function bindPathFillByKind(ctx: DrawContext, fill: FillStyle): ShaderProgram | null {
  const kind = fill.fill ?? 'solid';
  if (kind === 'solid') return bindPathFillSolid(ctx, fill as { color: string; opacity?: number });
  if (kind === 'pattern') return bindPathFillPattern(ctx, fill as Extract<FillStyle, { fill: 'pattern' }>);
  return bindPathFillGradient(ctx, fill as Extract<FillStyle, { fill: 'linear-gradient' | 'radial-gradient' | 'conic-gradient' }>);
}

function bindPathFillSolid(ctx: DrawContext, fill: { color: string; opacity?: number }): ShaderProgram {
  const prog = ctx.pathFill;
  ctx.gl.useProgram(prog.handle);
  setProjAndModel(ctx, prog);
  setSolidPaintUniforms(ctx, prog, fill.color, fill.opacity);
  setColorMatrixUniforms(ctx, prog);
  return prog;
}
```

`bindPathFillPattern` and `bindPathFillGradient` are the existing bodies of `drawPathFillPattern` (`draw.ts:747`) and `drawPathFillGradient` (`draw.ts:808`) with the trailing `applyClipTest` / `bindVertexArray` / `drawElements` / `bindVertexArray(null)` removed and `prog` returned. Keep every uniform, the `gradRampCache.upload`/`bind` pair, the `textureCache.upload`/`bind` pair, and the unregistered-texture guard — that guard becomes `return null` instead of a bare `return`.

Move each function's `gl.bindVertexArray(handle.vao)` out of the bind half: the VAO belongs to the draw.

- [ ] **Step 2: Rebuild `drawPathFillByKind` on the pair**

```ts
function drawPathFillByKind(ctx: DrawContext, fill: FillStyle, handle: GLMeshHandle): void {
  const prog = bindPathFillByKind(ctx, fill);
  if (!prog) return;
  const gl = ctx.gl;
  gl.bindVertexArray(handle.vao);
  applyClipTest(ctx);
  gl.drawElements(gl.TRIANGLES, handle.indexCount, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
}
```

- [ ] **Step 3: Run the full renderer suite to prove nothing moved**

Run: `npx vitest run --project=kit packages/core/src/renderer/`

Expected: PASS, with the same counts as before the refactor. The two tests from Task 1 still fail — they are gated on the throw, which is still there.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` from the repo root.
Expected: clean. (`tsc -p packages/core/tsconfig.json` reports 31 pre-existing `TS6059` errors on a clean tree — do not run that one.)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/renderer/draw.ts
git commit -m "split fill painting into a bind half and a draw half"
```

---

## Task 3: Paint a non-solid stroke on the plain ribbon path

**Files:**
- Modify: `packages/core/src/renderer/draw.ts:1027-1096`

- [ ] **Step 1: Delete the throw**

In `drawPathStroke` (`draw.ts:1027`), remove these four lines:

```ts
  const paint = stroke.paint;
  if (paint.fill !== undefined && paint.fill !== 'solid') {
    throw new Error('weasel step 2: stroke.paint must be solid; gradient/pattern arrives in step 5+');
  }
```

- [ ] **Step 2: Route the non-solid case in `drawPathStrokeUnclipped`**

Replace the head of `drawPathStrokeUnclipped` (`draw.ts:1045-1058`) so it mirrors `drawPathFill`'s shape. `isSolid` gates the staging exactly as it does there.

```ts
function drawPathStrokeUnclipped(ctx: DrawContext, cmd: PathDrawCommand): void {
  const stroke = cmd.stroke!;
  const paint = stroke.paint;
  const isSolid = paint.fill === undefined || paint.fill === 'solid';
  const solid = paint as { color: string; opacity?: number };
  const mesh = strokeMesh(cmd.path, stroke, ctx.flattenTolerance);
  if (mesh.indices.length === 0) return;

  const hasVColors = !!(stroke.vertexColors && stroke.vertexColors.length > 0);

  // A run holds one solid color, so anything else stages as `undefined`,
  // which drains the run and hands the draw back.
  if (tryStageSolid(ctx, mesh, isSolid && !hasVColors ? solid : undefined)) return;

  const handle = hasVColors
    ? ctx.meshCache.uploadTransient(mesh)
    : ctx.meshCache.uploadRecurring(mesh);

  if (!isSolid && !hasVColors) {
    drawPathFillByKind(ctx, paint, handle);
    return;
  }

  const gl = ctx.gl;
  // … existing hasVColors branch and solid tail, unchanged …
```

The rest of the function stays exactly as it is.

- [ ] **Step 3: Handle the vertex-colors collision**

`setSolidPaintUniforms(ctx, prog, solid.color, solid.opacity)` in the `hasVColors` branch reads `.color` off the paint, which is `undefined` on a gradient. Per-vertex colors are the more specific instruction, so they win and the base color becomes identity. In the `hasVColors` branch only, replace the `setSolidPaintUniforms` call with:

```ts
    // Per-vertex colors are the paint here; a non-solid base has no single
    // color to multiply by, so white leaves the vertex colors unmodified.
    setSolidPaintUniforms(ctx, prog, isSolid ? solid.color : '#ffffff', paint.opacity);
```

Before committing, confirm the vertex-color shader multiplies `u_color` by `a_vertexColor` rather than ignoring one of them — read `packages/core/src/renderer/shaders/` for the `pathFillVColor` fragment source. If it *ignores* `u_color`, drop this step's change and note that in the commit body.

- [ ] **Step 4: Run the Task 1 tests**

Run: `npx vitest run --project=kit packages/core/src/renderer/draw.strokePaint.test.ts`

Expected: the first test (`paints a gradient stroke instead of throwing`) PASSES. The second (inner-aligned) also stops throwing, but is not yet correct — Task 4 covers it.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/renderer/draw.ts
git commit -m "paint a gradient or pattern stroke on the plain ribbon path"
```

---

## Task 4: Paint a non-solid stroke under the inner/outer stencil

The stencilled path owns its stencil state, so it binds paint and draws itself.

**Files:**
- Modify: `packages/core/src/renderer/draw.ts:1112-1184`

- [ ] **Step 1: Write the test that catches the silent failure**

Add to `draw.strokePaint.test.ts`. A doubled ribbon painted without the stencil test is twice as tall as one painted with it, which is what the alignment clip exists to prevent — the same measurement `draw.strokeAlign.test.ts` uses.

```ts
  /** The stencil test that clips a doubled ribbon to one side is GL global
   *  state, and `applyClipTest` disables it at clip depth 0. A paint bound
   *  through the wrong seam wipes it out and the stroke silently paints at
   *  double width, centred. */
  it('keeps the inner/outer stencil test when the paint is a gradient', () => {
    render({ width: 10, align: 'inner', paint: GRADIENT });
    const enables = recorder.calls.filter((c) => c.name === 'enable' && c.args[0] === 0x0B90);
    const disables = recorder.calls.filter((c) => c.name === 'disable' && c.args[0] === 0x0B90);
    const lastEnable = recorder.calls.lastIndexOf(enables[enables.length - 1]);
    const draws = recorder.calls
      .map((c, i) => ({ c, i }))
      .filter(({ c }) => c.name === 'drawElements');
    const ribbonDraw = draws[draws.length - 1].i;
    const clobbered = disables.some((d) => {
      const at = recorder.calls.lastIndexOf(d);
      return at > lastEnable && at < ribbonDraw;
    });
    expect(clobbered).toBe(false);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/renderer/draw.strokePaint.test.ts -t 'keeps the inner/outer'`

Expected: FAIL — `expected true to be false`. After Task 3 the gradient reaches `drawPathStrokeStenciled`, whose `prog` is still `ctx.pathFill` bound with a `.color` of `undefined`, and nothing clips it.

- [ ] **Step 3: Bind the real paint in `drawPathStrokeStenciled`**

Two edits inside `drawPathStrokeStenciled`.

First, at the top, replace the unconditional solid cast (`draw.ts:1117`):

```ts
  const stroke = cmd.stroke!;
  const paint = stroke.paint;
  const isSolid = paint.fill === undefined || paint.fill === 'solid';
  const solid = paint as { color: string; opacity?: number };
```

Second, replace the program selection and the paint uniforms. The existing `gl.useProgram(prog)` + `setProjAndModel(ctx, prog)` near `draw.ts:1138` must stay ahead of the silhouette pass — that pass draws the fill mesh into the stencil with the color mask off, and needs *a* bound program, so leave it binding `ctx.pathFill`.

Then, where `setSolidPaintUniforms(ctx, prog, solid.color, solid.opacity)` sits at `draw.ts:1156` (after the `colorMask(true,…)` restore, before the ribbon VAO bind), swap it for:

```ts
  // Bind the real paint here, not through `drawPathFillByKind`: that calls
  // `applyClipTest`, which at clip depth 0 disables the stencil test this
  // function just set up to clip the ribbon to one side.
  const ribbonProg = useVColor
    ? bindPathFillSolid(ctx, { color: isSolid ? solid.color : '#ffffff', opacity: paint.opacity })
    : bindPathFillByKind(ctx, paint);
  if (!ribbonProg) { gl.stencilMask(0x01); gl.clear(gl.STENCIL_BUFFER_BIT); gl.disable(gl.STENCIL_TEST); return; }
  setColorMatrixUniforms(ctx, ribbonProg);
```

Replace the later uses of `prog` for the ribbon — the `prog.attribute('a_vertexColor')` lookup in the `useVColor` block — with `ribbonProg`.

- [ ] **Step 4: Run the whole file**

Run: `npx vitest run --project=kit packages/core/src/renderer/draw.strokePaint.test.ts`

Expected: PASS, all three.

- [ ] **Step 5: Run the alignment suite, which is the regression risk**

Run: `npx vitest run --project=kit packages/core/src/renderer/draw.strokeAlign.test.ts packages/core/src/renderer/draw.test.ts`

Expected: PASS, unchanged counts.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderer/draw.ts packages/core/src/renderer/draw.strokePaint.test.ts
git commit -m "clip a non-solid stroke to its alignment side"
```

---

## Task 5: Stop painting a non-solid even-odd fill black

Same missing route, one severity down: it warns and substitutes black rather than throwing.

**Files:**
- Modify: `packages/core/src/renderer/draw.ts:975-1000`

- [ ] **Step 1: Write the failing test**

```ts
  it('paints an even-odd gradient fill as a gradient, not as black', () => {
    recorder.reset();
    const path: PolygonPath = { ...horizontalLine(), fillRule: 'evenodd' };
    r.render([{ kind: 'path', path, fill: GRADIENT } as DrawCommand]);
    const warned = recorder.calls.some((c) => c.name === 'useProgram');
    expect(warned).toBe(true);
    // The gradient program uploads a ramp texture; the solid path never does.
    expect(recorder.calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/renderer/draw.strokePaint.test.ts -t 'even-odd'`

Expected: FAIL on the `texImage2D` assertion — the current code substitutes `{ color: '#000' }` and never touches the ramp cache.

- [ ] **Step 3: Replace the black substitution**

In `drawPathFillStencil` (`draw.ts:980`), delete the `console.warn` and the `{ color: '#000' }` substitution, and bind the real paint through `bindPathFillByKind` — this function owns its own stencil state for the even-odd pass, exactly like Task 4's, so it must use the bind half rather than `drawPathFillByKind`. Read the function's existing stencil sequence and place the bind after the colour mask is restored, matching what Task 4 did.

- [ ] **Step 4: Run the suite**

Run: `npx vitest run --project=kit packages/core/src/renderer/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/renderer/draw.ts packages/core/src/renderer/draw.strokePaint.test.ts
git commit -m "paint a non-solid even-odd fill with its own paint"
```

---

## Task 6: Prove the original bug is dead end to end

The unit tests drive the renderer directly. This one goes through SVG import, which is where the crash actually came from.

**Files:**
- Modify: `packages/core/src/renderer/draw.strokePaint.test.ts`

- [ ] **Step 1: Write the round-trip test**

```ts
  it('renders a shape whose gradient stroke came from SVG import', async () => {
    const { parseSvg } = await import('@weasel-js/svg');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>
      </linearGradient></defs>
      <rect x="10" y="10" width="100" height="50" fill="none" stroke="url(#g)" stroke-width="4"/>
    </svg>`;
    const parsed = parseSvg(svg);
    expect(() => r.render(toDrawCommands(parsed))).not.toThrow();
  });
```

Check `@weasel-js/svg`'s barrel for the real entry point and the shape it returns before writing this — `parseSvg` and `toDrawCommands` are the intent, not necessarily the names. If wiring a full import into a renderer test proves to need more scaffolding than the test is worth, assert the narrower thing instead: that `strokeDataFromSvg` produces a `Stroke` whose `paint.fill` is `'linear-gradient'`, and that `r.render` accepts a command carrying it. State in the commit body which one you did.

- [ ] **Step 2: Run it**

Run: `npx vitest run --project=kit packages/core/src/renderer/draw.strokePaint.test.ts`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/renderer/draw.strokePaint.test.ts
git commit -m "cover the imported gradient stroke end to end"
```

---

## Task 7: Changeset and full verification

- [ ] **Step 1: Write the changeset**

Create `.changeset/nonsolid-stroke-paint.md`. **`patch`.** Do not write a `bump-approved` marker — that requires explicit sign-off in conversation, every time.

```markdown
---
'@weasel-js/core': patch
---

Paint a gradient or pattern stroke instead of throwing.

`Stroke.paint` has always been a full `FillStyle`, and SVG import puts paint
servers there deliberately, but the renderer refused anything but a solid — so
importing a shape with `stroke="url(#grad)"` produced a scene that threw on the
next frame. Both stroke paths now paint the ribbon through the same route a
fill takes, including under the inner/outer alignment stencil. A non-solid
even-odd fill no longer renders black.
```

- [ ] **Step 2: Run everything**

```bash
npx tsc --noEmit
npx vitest run --project=kit
npm run lint
```

Expected: all clean. Note that `SceneCanvas.animatedZoom.test.tsx` fails intermittently under full-suite load and passes alone — that one is pre-existing and not yours.

- [ ] **Step 3: Check the visual baselines**

Run: `npm run test:visual` (or the repo's visual script — check `package.json`).

Expected: PASS. If a stroke baseline moves, look at the diff before re-baselining: a local PASS does not imply CI passes, because Chromium anti-aliases hairline 2D strokes only on GPU.

- [ ] **Step 4: Commit**

```bash
git add .changeset/nonsolid-stroke-paint.md
git commit -m "add a changeset for non-solid stroke paint"
```

---

## Self-review notes

- **Spec coverage.** Arc 1 of the spec names three things: route the ribbon through `drawPathFillByKind` (Tasks 3–4), the stencilled path needing the same treatment (Task 4), and the even-odd black fallback (Task 5). The spec's "first test to write" is Task 1, and its end-to-end version is Task 6.
- **Deliberately not here.** `setStroke` still takes only `{ color }` — that is Arc 2b, and nothing in the UI can produce a gradient stroke until it lands. This arc makes imported ones render; it does not make new ones authorable.
- **The bind/draw split is Arc 3's seam too.** A registered paint kind needs the same pair so it works under a stencil. Do not collapse it back.
