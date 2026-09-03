# Renderer target rect — arc 1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "this renderer owns a rect of a buffer it does not own" a real, tested `WeaselRenderer` API instead of something that happens to work.

**Architecture:** `WeaselRenderer` gains a nullable *target* — an origin within the drawing buffer plus a clear policy. Its size is the renderer's existing `widthCss`/`heightCss`, so there is exactly one source of output size. `render()` re-establishes viewport, scissor and the blend/depth/cull/clear-colour state it assumes on every frame, because a co-tenant sharing the context moves all of it between frames. The constructor rejects a context with no stencil buffer.

**Tech Stack:** TypeScript, WebGL2, vitest (unit, `--project=kit`), Playwright (real-GL guard tests under `tests/visual`, reporting-only measurement under `tests/perf`).

**Spec:** `docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`, "Arc 1 — `WeaselRenderer` targets a rect".

---

## Context you need before Task 1

**The spike already did part of this and got it slightly wrong.** Commit `c905610a`
added `setTargetRect()` plus an `applyTarget()` call inside `render()`. It works —
two panes drew into one buffer with the scissor confining each frame clear — but it
carries the rect's width and height as well as its origin, which duplicates
`widthCss`/`heightCss` and lets the two disagree. This plan replaces it with
`setTarget()` carrying origin + clear policy only. Task 4 deletes the spike method;
do not try to keep both.

**Why the stencil matters.** `renderer/draw.ts` splits the stencil: bit 0 is used
exclusively by even-odd fills and stenciled strokes (`drawPathFillStencil`,
`drawPathStrokeStenciled`), and clip levels occupy bits 1–7 (`ancestorMask()`,
`pushClip`). The spec expects a pane that does not clear stencil inside its own rect
to inherit its neighbour's bits and fill its even-odd holes. Task 8 Step 5 tests that
expectation rather than assuming it — bit 0 appears to self-clean after each fill,
which would make the frame's stencil clear redundant, and the plan says what to do
with either answer.

**Why the GL recorder needs work first.** `test-utils/glRecorder.ts` is a Proxy: any
ALL-CAPS property it does not know returns `0`, and any lowercase property returns a
recording *function*. `SCISSOR_TEST` is not in its constants table, so
`enable(SCISSOR_TEST)` records `[0]` and asserting on it compares 0 to 0. And
`gl.drawingBufferHeight` is lowercase, so it comes back as a function and the y-flip
arithmetic yields `NaN` — without a single test failing. Task 1 fixes both before
anything depends on them. **This is the plan's most important task** — skip it and
Tasks 2–5 get tests that cannot fail.

---

## File Structure

| File | Responsibility |
|---|---|
| `packages/core/src/renderer/test-utils/glRecorder.ts` | *Modify.* Add `SCISSOR_TEST`, numeric `drawingBufferWidth`/`Height`, configurable `getContextAttributes`. |
| `packages/core/src/renderer/test-utils/glRecorder.test.ts` | *Create.* Pins the three above, so a later assertion on them means something. |
| `packages/core/src/renderer/WeaselRenderer.ts` | *Modify.* `RenderTarget`, `setTarget`/`getTarget`, `applyTarget`, `applyGlState`, stencil check. |
| `packages/core/src/renderer/WeaselRenderer.target.test.ts` | *Create.* Unit tests for target, clear policy, per-frame state, stencil check. Kept out of the existing `WeaselRenderer.test.ts`, which is already 11KB of constructor/resize/dispose cases. |
| `packages/core/src/canvas/Canvas.tsx` | *Modify.* `paintInto` calls `setTarget` instead of the spike's `setTargetRect`. |
| `apps/site/demos/TiledSurfaceDemo.tsx` | *Create.* Replaces `apps/site/spike-arc2.tsx`: N `SceneCanvas`es on one surface. |
| `apps/site/spike-arc2.{html,tsx}` | *Delete.* The demo supersedes it. |
| `apps/site/registry.ts` | *Modify.* One `DEMO_META` entry. |
| `tests/visual/tiled-surface.spec.ts` | *Create.* Real-GL guard: scissor containment, clipping at the pane edge, even-odd holes. |
| `tests/perf/tiled-surface.spec.ts` | *Create.* Reports N-renderers vs one-resized. Does not gate. |
| `.changeset/*.md` | *Create.* `patch`. |

---

### Task 1: The GL recorder can express scissor, buffer size and context attributes

**Files:**
- Modify: `packages/core/src/renderer/test-utils/glRecorder.ts`
- Test: `packages/core/src/renderer/test-utils/glRecorder.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/renderer/test-utils/glRecorder.test.ts`:

```ts
/**
 * The recorder's Proxy answers `0` for any ALL-CAPS property it does not know
 * and a recording *function* for any lowercase one. Both failure modes are
 * silent, and both produce tests that pass against broken code — an
 * `enable(SCISSOR_TEST)` assertion compares 0 to 0, and `drawingBufferHeight`
 * arithmetic yields NaN. These pin the three the target-rect work depends on.
 */
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './glRecorder';

describe('makeGLRecorder', () => {
  it('gives SCISSOR_TEST a value distinct from the other capability flags', () => {
    const { gl } = makeGLRecorder();
    expect(gl.SCISSOR_TEST).toBe(0x0C11);
    for (const other of [gl.BLEND, gl.DEPTH_TEST, gl.CULL_FACE, gl.STENCIL_TEST]) {
      expect(gl.SCISSOR_TEST).not.toBe(other);
    }
  });

  it('reports drawing-buffer dimensions as numbers, not recording functions', () => {
    const { gl } = makeGLRecorder({ drawingBufferWidth: 1640, drawingBufferHeight: 800 });
    expect(gl.drawingBufferWidth).toBe(1640);
    expect(gl.drawingBufferHeight).toBe(800);
    expect(gl.drawingBufferHeight - 100).toBe(700);
  });

  it('defaults the drawing buffer to a non-zero size', () => {
    const { gl } = makeGLRecorder();
    expect(typeof gl.drawingBufferWidth).toBe('number');
    expect(gl.drawingBufferWidth).toBeGreaterThan(0);
  });

  it('reports context attributes, defaulting to a stencil buffer', () => {
    expect(makeGLRecorder().gl.getContextAttributes()).toMatchObject({ stencil: true });
    const noStencil = makeGLRecorder({ contextAttributes: { stencil: false } });
    expect(noStencil.gl.getContextAttributes()).toMatchObject({ stencil: false });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/renderer/test-utils/glRecorder.test.ts`

Expected: FAIL. `gl.SCISSOR_TEST` is `0`; `gl.drawingBufferWidth` is a function, so `typeof` is `'function'`; `getContextAttributes()` returns `undefined`.

- [ ] **Step 3: Add the constant**

In `glRecorder.ts`, inside `GL_CONSTANTS`, under the `// Errors / state` group, after `CULL_FACE: 0x0B44,`:

```ts
  SCISSOR_TEST: 0x0C11,
```

- [ ] **Step 4: Make the recorder configurable**

Replace the `GLRecorder` interface and the `makeGLRecorder` signature/Proxy in `glRecorder.ts`:

```ts
export interface GLRecorderOptions {
  /** Reported as `gl.drawingBufferWidth`. Default 800. */
  drawingBufferWidth?: number;
  /** Reported as `gl.drawingBufferHeight`. Default 600. */
  drawingBufferHeight?: number;
  /** Returned by `gl.getContextAttributes()`. Default `{ stencil: true }`. */
  contextAttributes?: Partial<WebGLContextAttributes>;
}

export interface GLRecorder {
  readonly gl: WebGL2RenderingContext;
  readonly calls: GLCall[];
  reset(): void;
}

export function makeGLRecorder(options: GLRecorderOptions = {}): GLRecorder {
  const calls: GLCall[] = [];
  const {
    drawingBufferWidth = 800,
    drawingBufferHeight = 600,
    contextAttributes = { stencil: true },
  } = options;

  // Read as data, not called. The Proxy below hands back a recording function
  // for every lowercase property, so without this `drawingBufferHeight` is a
  // function and every y-flip computed from it is NaN — silently.
  const DATA_PROPERTIES: Readonly<Record<string, unknown>> = {
    drawingBufferWidth,
    drawingBufferHeight,
  };
```

Keep the existing `handler` unchanged, then add a `getContextAttributes` case to its
`switch`, immediately before `case 'getError':`:

```ts
      case 'getContextAttributes':
        result = { ...contextAttributes };
        break;
```

and change the Proxy's `get` trap to consult the data table first:

```ts
      get(_, prop: string | symbol) {
        if (typeof prop !== 'string') return undefined;
        if (prop in DATA_PROPERTIES) return DATA_PROPERTIES[prop];
        if (prop in GL_CONSTANTS) return GL_CONSTANTS[prop];
        if (/^[A-Z_0-9]+$/.test(prop)) return 0; // unknown all-caps constant → 0
        return handler(prop);
      },
```

- [ ] **Step 5: Run the new test and the whole renderer suite**

Run: `npx vitest run --project=kit packages/core/src/renderer/`

Expected: PASS, including the pre-existing `WeaselRenderer.test.ts`, `draw.test.ts` and `solidBatch.test.ts` — every existing `makeGLRecorder()` call site passes no argument and must keep working.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderer/test-utils/glRecorder.ts packages/core/src/renderer/test-utils/glRecorder.test.ts
git commit -m "let the GL recorder express scissor, buffer size and context attributes"
```

---

### Task 2: A context with no stencil buffer fails loudly

**Files:**
- Modify: `packages/core/src/renderer/WeaselRenderer.ts`
- Test: `packages/core/src/renderer/WeaselRenderer.target.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/renderer/WeaselRenderer.target.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './test-utils/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';

describe('WeaselRenderer stencil requirement', () => {
  it('throws when the injected context has no stencil buffer', () => {
    const { gl } = makeGLRecorder({ contextAttributes: { stencil: false } });
    expect(() => new WeaselRenderer({ gl, width: 100, height: 100, dpr: 1 }))
      .toThrow(/stencil/i);
  });

  it('constructs against a context that has one', () => {
    const { gl } = makeGLRecorder({ contextAttributes: { stencil: true } });
    expect(() => new WeaselRenderer({ gl, width: 100, height: 100, dpr: 1 }))
      .not.toThrow();
  });

  it('constructs against a context that cannot report its attributes', () => {
    // A stub without the method must not be treated as a stencil-less context:
    // several existing tests and every non-browser harness pass one.
    const { gl } = makeGLRecorder();
    Object.defineProperty(gl, 'getContextAttributes', { value: undefined });
    expect(() => new WeaselRenderer({ gl, width: 100, height: 100, dpr: 1 }))
      .not.toThrow();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/renderer/WeaselRenderer.target.test.ts`

Expected: FAIL on the first case — nothing checks attributes, so no throw. The other two pass already.

- [ ] **Step 3: Add the check**

In `WeaselRenderer.ts`, in the constructor, immediately after `this.gl = gl as WebGL2RenderingContext;`:

```ts
    // Bits 0-7 are load-bearing: bit 0 for even-odd fills and stenciled
    // strokes, bits 1-7 for clip depth (`renderer/draw.ts`). Without a stencil
    // buffer both render wrong rather than not at all, so refuse the context
    // instead of painting a plausible lie. A stub that cannot answer is not a
    // stencil-less context — only an explicit `false` is.
    const attrs = typeof this.gl.getContextAttributes === 'function'
      ? this.gl.getContextAttributes()
      : null;
    if (attrs && attrs.stencil === false) {
      throw new Error(
        'WeaselRenderer: the supplied WebGL2 context has no stencil buffer. '
        + 'Create it with { stencil: true } — clips and even-odd fills need one.',
      );
    }
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run --project=kit packages/core/src/renderer/WeaselRenderer.target.test.ts`

Expected: PASS, 3 tests.

- [ ] **Step 5: Check nothing else constructed a stencil-less renderer**

Run: `npx vitest run --project=kit`

Expected: PASS. The three production construction sites (`Canvas.tsx:1386`,
`sceneViewRender.ts:215`, `renderSceneToPixels.ts:228`) all request
`{ stencil: true }` already; this step confirms no test fixture did not.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderer/WeaselRenderer.ts packages/core/src/renderer/WeaselRenderer.target.test.ts
git commit -m "refuse a WebGL2 context with no stencil buffer"
```

---

### Task 3: Blend, depth, cull and clear colour are re-established every frame

**Files:**
- Modify: `packages/core/src/renderer/WeaselRenderer.ts`
- Test: `packages/core/src/renderer/WeaselRenderer.target.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `WeaselRenderer.target.test.ts`:

```ts
describe('WeaselRenderer per-frame GL state', () => {
  it('re-establishes blend, depth, cull and clear colour on every render', () => {
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 100, dpr: 1 });
    // Constructor state is not the claim — a co-tenant moves all of it between
    // our frames, so the second frame must set it again just like the first.
    r.render([]);
    recorder.reset();
    r.render([]);

    const names = recorder.calls.map((c) => c.name);
    expect(names).toContain('blendFunc');
    expect(names).toContain('clearColor');

    const enabled = recorder.calls.filter((c) => c.name === 'enable').map((c) => c.args[0]);
    expect(enabled).toContain(recorder.gl.BLEND);

    const disabled = recorder.calls.filter((c) => c.name === 'disable').map((c) => c.args[0]);
    expect(disabled).toContain(recorder.gl.DEPTH_TEST);
    expect(disabled).toContain(recorder.gl.CULL_FACE);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/renderer/WeaselRenderer.target.test.ts -t "per-frame GL state"`

Expected: FAIL — the state is set in the constructor only, so the second frame records none of it.

- [ ] **Step 3: Extract the state block into a method**

In `WeaselRenderer.ts`, add this private method next to `applyViewport`:

```ts
  /** The GL state every frame assumes. Applied per `render()` rather than once
   *  at construction because a co-tenant sharing this context moves all of it
   *  between our frames. */
  private applyGlState(): void {
    const gl = this.gl;
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
  }
```

In the constructor, replace these five lines:

```ts
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
    this.gl.disable(this.gl.DEPTH_TEST);
    this.gl.disable(this.gl.CULL_FACE);
    this.gl.clearColor(0, 0, 0, 0);
```

with:

```ts
    this.applyGlState();
```

In `onContextRestored()`, replace the identical five lines with the same single call.

- [ ] **Step 4: Call it from `render()`**

In `render()`, immediately after `this.groupState.reset();`:

```ts
    this.applyGlState();
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run --project=kit packages/core/src/renderer/`

Expected: PASS. `WeaselRenderer.test.ts`'s "configures alpha blending" constructor
case still passes — the constructor still applies the state, through the method.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderer/WeaselRenderer.ts packages/core/src/renderer/WeaselRenderer.target.test.ts
git commit -m "re-establish blend, depth, cull and clear colour every frame"
```

---

### Task 4: `setTarget()` confines the renderer to a rect of its buffer

The target carries an **origin only**. Its size is `widthCss`/`heightCss` — the size
`resize()` already owns and `DrawContext` already reports to screen-space layers.
Carrying a second size would let the two disagree, which is the one bug this API
should be incapable of.

**Files:**
- Modify: `packages/core/src/renderer/WeaselRenderer.ts` (replaces the spike's `setTargetRect`)
- Test: `packages/core/src/renderer/WeaselRenderer.target.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `WeaselRenderer.target.test.ts`:

```ts
describe('WeaselRenderer.setTarget', () => {
  it('owns the whole buffer by default', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 800, drawingBufferHeight: 600 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
    r.render([]);

    expect(r.getTarget()).toBeNull();
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([0, 0, 800, 600]);
    const disabled = recorder.calls.filter((c) => c.name === 'disable').map((c) => c.args[0]);
    expect(disabled).toContain(recorder.gl.SCISSOR_TEST);
  });

  it('flips the origin to GL bottom-left and scissors to the same rect', () => {
    // Buffer 820x400 CSS at dpr 1; a 380x360 renderer at CSS (420, 20).
    // GL y = 400 - 20 - 360 = 20.
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    recorder.reset();
    r.render([]);

    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([420, 20, 380, 360]);
    const scissor = recorder.calls.filter((c) => c.name === 'scissor').at(-1)!;
    expect(scissor.args).toEqual([420, 20, 380, 360]);
    const enabled = recorder.calls.filter((c) => c.name === 'enable').map((c) => c.args[0]);
    expect(enabled).toContain(recorder.gl.SCISSOR_TEST);
  });

  it('scales origin and size by dpr', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 1640, drawingBufferHeight: 800 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 2 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    recorder.reset();
    r.render([]);

    // GL y = 800 - 40 - 720 = 40.
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([840, 40, 760, 720]);
  });

  it('re-applies the target on every frame, not just when it is set', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    r.render([]);
    recorder.reset();
    r.render([]);

    const scissor = recorder.calls.filter((c) => c.name === 'scissor').at(-1)!;
    expect(scissor.args).toEqual([420, 20, 380, 360]);
  });

  it('follows a resize without the target being set again', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    r.resize({ width: 200, height: 100, dpr: 1 });
    recorder.reset();
    r.render([]);

    // GL y = 400 - 20 - 100 = 280.
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([420, 280, 200, 100]);
  });

  it('setTarget(null) returns the whole buffer and drops the scissor', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    r.setTarget(null);
    recorder.reset();
    r.render([]);

    expect(r.getTarget()).toBeNull();
    const viewport = recorder.calls.filter((c) => c.name === 'viewport').at(-1)!;
    expect(viewport.args).toEqual([0, 0, 380, 360]);
    const disabled = recorder.calls.filter((c) => c.name === 'disable').map((c) => c.args[0]);
    expect(disabled).toContain(recorder.gl.SCISSOR_TEST);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/renderer/WeaselRenderer.target.test.ts -t "setTarget"`

Expected: FAIL — `setTarget` and `getTarget` do not exist. (`setTargetRect` from the spike does; it is about to go.)

- [ ] **Step 3: Replace the spike's method with the real one**

In `WeaselRenderer.ts`, add above the class:

```ts
/** Where a renderer draws inside a buffer it does not own.
 *
 *  The rect's SIZE is the renderer's own `width`/`height` — `resize()` owns
 *  that, and a second copy here could disagree with the one `DrawContext`
 *  reports to screen-space layers. */
export interface RenderTarget {
  /** Top-left of this renderer's output within the drawing buffer, in CSS
   *  pixels, with the origin at the buffer's top-left. GL's bottom-left origin
   *  is handled internally. */
  origin: { x: number; y: number };
  /** Clear colour and stencil within the rect before drawing. Default true.
   *  Pass false only when the caller clears the whole buffer itself on behalf
   *  of every co-tenant — a frame that clears neither inherits its neighbour's
   *  stencil bits, and even-odd fills then fill their holes. */
  clear?: boolean;
}
```

Replace the spike's `targetRect` field:

```ts
  private targetRect: { x: number; y: number; width: number; height: number } | null = null;
```

with:

```ts
  private target: RenderTarget | null = null;
```

Delete the spike's `setTargetRect` method and its `applyViewport` guard, and replace
`applyViewport` and `applyTarget` with this single method:

```ts
  /** Viewport and scissor for this frame. Re-applied inside `render()` because
   *  a co-tenant on the same context moves both between our frames. */
  private applyTarget(): void {
    const gl = this.gl;
    const w = Math.round(this.widthCss * this.dpr);
    const h = Math.round(this.heightCss * this.dpr);
    if (!this.target) {
      gl.disable(gl.SCISSOR_TEST);
      gl.viewport(0, 0, w, h);
      return;
    }
    const x = Math.round(this.target.origin.x * this.dpr);
    const y = gl.drawingBufferHeight - Math.round(this.target.origin.y * this.dpr) - h;
    gl.viewport(x, y, w, h);
    gl.scissor(x, y, w, h);
    gl.enable(gl.SCISSOR_TEST);
  }

  /** Confine this renderer to a rect of its drawing buffer, or pass null to
   *  give it the whole buffer back. Takes effect from the next `render()`. */
  setTarget(target: RenderTarget | null): void {
    this.target = target;
    this.applyTarget();
  }

  getTarget(): RenderTarget | null {
    return this.target;
  }
```

Update the two remaining `this.applyViewport()` call sites — one at the end of the
constructor, one at the end of `resize()` — to `this.applyTarget()`.

The call inside `render()` is already there from the spike, immediately after
`this.groupState.reset();` and before the frame clear. **Leave it where it is.**
Task 5 depends on that order: `gl.clear` respects `SCISSOR_TEST`, so a clear issued
before the scissor is enabled erases every co-tenant. With Task 3 applied, the top of
`render()` reads:

```ts
    this.groupState.reset();
    this.applyGlState();
    this.applyTarget();
```

- [ ] **Step 4: Export the type**

In `packages/core/src/renderer/index.ts`, add `RenderTarget` to the existing
`WeaselRenderer` export line. If the file re-exports with `export { WeaselRenderer } from './WeaselRenderer';`, make it:

```ts
export { WeaselRenderer } from './WeaselRenderer';
export type { RenderTarget } from './WeaselRenderer';
```

Then run `grep -n "WeaselRenderer" packages/core/src/index.ts` and add the same
`export type { RenderTarget }` beside it, **by name** — never `export * from` another
workspace package (see CLAUDE.md, "esbuild cannot see through the package boundary").

- [ ] **Step 5: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/renderer/`

Expected: PASS. `WeaselRenderer.test.ts`'s "sets initial viewport" and "updates
viewport on resize" still pass — untargeted behaviour is unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/renderer/WeaselRenderer.ts packages/core/src/renderer/WeaselRenderer.target.test.ts packages/core/src/renderer/index.ts packages/core/src/index.ts
git commit -m "give WeaselRenderer a target rect applied inside render()"
```

---

### Task 5: The clear policy

**Files:**
- Modify: `packages/core/src/renderer/WeaselRenderer.ts`
- Test: `packages/core/src/renderer/WeaselRenderer.target.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `WeaselRenderer.target.test.ts`:

```ts
describe('WeaselRenderer clear policy', () => {
  const clearCalls = (recorder: ReturnType<typeof makeGLRecorder>) =>
    recorder.calls.filter((c) => c.name === 'clear');

  it('clears colour and stencil by default', () => {
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 100, dpr: 1 });
    recorder.reset();
    r.render([]);
    const bits = recorder.gl.COLOR_BUFFER_BIT | recorder.gl.STENCIL_BUFFER_BIT;
    expect(clearCalls(recorder).some((c) => c.args[0] === bits)).toBe(true);
  });

  it('clears by default under a target too', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    recorder.reset();
    r.render([]);
    expect(clearCalls(recorder).length).toBeGreaterThan(0);
  });

  it('skips the frame clear when the target says clear: false', () => {
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 }, clear: false });
    recorder.reset();
    r.render([]);
    const bits = recorder.gl.COLOR_BUFFER_BIT | recorder.gl.STENCIL_BUFFER_BIT;
    expect(clearCalls(recorder).some((c) => c.args[0] === bits)).toBe(false);
  });

  it('enables the scissor before clearing, so the clear cannot outrun the rect', () => {
    // Ordering is the whole mechanism: gl.clear respects SCISSOR_TEST, so a
    // clear issued before the scissor is enabled erases every co-tenant.
    const recorder = makeGLRecorder({ drawingBufferWidth: 820, drawingBufferHeight: 400 });
    const r = new WeaselRenderer({ gl: recorder.gl, width: 380, height: 360, dpr: 1 });
    r.setTarget({ origin: { x: 420, y: 20 } });
    recorder.reset();
    r.render([]);

    const names = recorder.calls.map((c) => c.name);
    const scissorEnabled = recorder.calls.findIndex(
      (c) => c.name === 'enable' && c.args[0] === recorder.gl.SCISSOR_TEST,
    );
    const firstClear = names.indexOf('clear');
    expect(scissorEnabled).toBeGreaterThanOrEqual(0);
    expect(firstClear).toBeGreaterThan(scissorEnabled);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run --project=kit packages/core/src/renderer/WeaselRenderer.target.test.ts -t "clear policy"`

Expected: FAIL on "skips the frame clear" — `render()` clears unconditionally. The
other three pass, including the ordering one (Task 4 already put `applyTarget()`
before the clear); it is there to keep that ordering from being refactored away.

- [ ] **Step 3: Make the clear conditional**

In `render()`, replace:

```ts
    gl.stencilMask(0xFF);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
```

with:

```ts
    if (this.target?.clear !== false) {
      gl.stencilMask(0xFF);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
    }
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/renderer/WeaselRenderer.target.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/renderer/WeaselRenderer.ts packages/core/src/renderer/WeaselRenderer.target.test.ts
git commit -m "let a target suppress the frame clear"
```

---

### Task 6: `<Canvas>` uses the real API

**Files:**
- Modify: `packages/core/src/canvas/Canvas.tsx`

- [ ] **Step 1: Update the call site**

In `paint()`, replace:

```ts
    renderer.setTargetRect(rect ? { x: rect.x, y: rect.y, width: w, height: h } : null);
```

with:

```ts
    renderer.setTarget(rect ? { origin: { x: rect.x, y: rect.y } } : null);
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit` (from the repo root — see CLAUDE.md on why not `-p packages/core`)

Expected: no output.

- [ ] **Step 3: Run the suite**

Run: `npx vitest run --project=kit`

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/core/src/canvas/Canvas.tsx
git commit -m "point Canvas at setTarget"
```

---

### Task 7: A `tiled-surface` demo replaces the spike page

The spike page is not a demo — it is not in the registry, has no blurb, and hand-rolls
its own stylesheet. This turns it into one and deletes it. Per CLAUDE.md, a demo is a
reference implementation: this one uses the scene graph, the gesture system and the
select tool, and hand-rolls nothing the kit provides.

**Files:**
- Create: `apps/site/demos/TiledSurfaceDemo.tsx`
- Delete: `apps/site/spike-arc2.html`, `apps/site/spike-arc2.tsx`
- Modify: `apps/site/registry.ts`

- [ ] **Step 1: Write the demo**

Create `apps/site/demos/TiledSurfaceDemo.tsx`:

```tsx
import { useLayoutEffect, useRef, useState } from 'react';
import {
  PathBuilder, SceneCanvas, WeaselProvider, sceneFromJSON, useSelection,
} from '@weasel-js/core';
import type { DrawCommand, FillStyle, SerializedScene, View } from '@weasel-js/core';

interface NodeData { fill: FillStyle; ring?: boolean }
interface Pose { x: number; y: number; width: number; height: number }

/** A rect with a rect-shaped hole, filled even-odd — so it goes through
 *  `drawPathFillStencil`, which uses stencil bit 0. The hole is what the guard
 *  test probes: it is only a hole while this pane's stencil state is its own. */
function ring(pose: Pose): ReturnType<PathBuilder['build']> {
  const b = new PathBuilder().setFillRule('evenodd');
  const { x, y, width: w, height: h } = pose;
  b.moveTo(x, y); b.lineTo(x + w, y); b.lineTo(x + w, y + h); b.lineTo(x, y + h); b.close();
  const i = Math.min(w, h) / 4;
  b.moveTo(x + i, y + i); b.lineTo(x + w - i, y + i);
  b.lineTo(x + w - i, y + h - i); b.lineTo(x + i, y + h - i); b.close();
  return b.build();
}

const SURFACE_W = 820;
const SURFACE_H = 400;
const PANE_W = 380;
const PANE_H = 360;

const PANES = [
  { id: 'A', x: 20, y: 20, view: { x: 0, y: 0, scale: { x: 1, y: 1 } } as View, fill: '#2d7d46', bg: '#e8f0fb' },
  { id: 'B', x: 420, y: 20, view: { x: -40, y: -30, scale: { x: 2, y: 2 } } as View, fill: '#2d5f9a', bg: '#fdf3d8' },
] as const;

const paneScene = (fill: string): SerializedScene<NodeData, string, Pose> => ({
  version: 1,
  systemLayers: [{ id: 'default' }],
  nodes: [
    { id: 'box', kind: 'leaf', layer: 'default',
      pose: { x: 40, y: 40, width: 100, height: 80 }, data: { fill: { color: fill } } },
    { id: 'mark', kind: 'leaf', layer: 'default',
      pose: { x: 180, y: 150, width: 60, height: 60 }, data: { fill: { color: '#c0392b' } } },
    { id: 'ring', kind: 'leaf', layer: 'default',
      pose: { x: 40, y: 180, width: 100, height: 100 },
      data: { fill: { color: '#6b4c9a' }, ring: true } },
  ],
} as unknown as SerializedScene<NodeData, string, Pose>);

function Pane({
  id, x, y, view, fill, bg, surface,
}: {
  id: string; x: number; y: number; view: View; fill: string; bg: string;
  surface: HTMLCanvasElement | null;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [input, setInput] = useState<HTMLDivElement | null>(null);
  const [scene] = useState(() => sceneFromJSON(paneScene(fill), {}));
  const selection = useSelection();

  useLayoutEffect(() => { setInput(boxRef.current); }, []);

  return (
    <>
      <div
        ref={boxRef}
        tabIndex={0}
        data-pane={id}
        className="ckd-tile-pane"
        style={{ left: x, top: y, width: PANE_W, height: PANE_H }}
      />
      {surface && input && (
        // One scope per pane: a shared <ActionsProvider> lets only the newest
        // canvas under it respond to input, and the rest go silently dead.
        <WeaselProvider isolate>
          <SceneCanvas
            width={PANE_W}
            height={PANE_H}
            scene={scene}
            selection={selection}
            view={view}
            paintInto={{ canvas: surface, x, y }}
            inputElement={input}
            backgroundFill={{ color: bg }}
            defaultTools={['select']}
            layers={{
              scene: {
                drawOne: (node, p): DrawCommand[] => [{
                  kind: 'path',
                  path: node.data.ring ? ring(node.pose as Pose) : p,
                  fill: node.data.fill,
                }],
              },
            }}
          />
        </WeaselProvider>
      )}
    </>
  );
}

export function TiledSurfaceDemo() {
  const surfaceRef = useRef<HTMLCanvasElement | null>(null);
  const [surface, setSurface] = useState<HTMLCanvasElement | null>(null);

  // The shared buffer is the host's to size. Each pane's renderer is handed
  // `gl` only — given the element it would resize it to its own pane.
  useLayoutEffect(() => {
    const c = surfaceRef.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(SURFACE_W * dpr);
    c.height = Math.round(SURFACE_H * dpr);
    c.style.width = `${SURFACE_W}px`;
    c.style.height = `${SURFACE_H}px`;
    setSurface(c);
  }, []);

  return (
    <div className="ckd-tile-surface" style={{ width: SURFACE_W, height: SURFACE_H }}>
      <canvas ref={surfaceRef} data-testid="tiled-surface" className="ckd-tile-canvas" />
      {PANES.map((p) => (
        <Pane key={p.id} {...p} surface={surface} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Add the three classes to the demo stylesheet**

Append to `apps/site/canvas-kit-demo.css`:

```css
.ckd-tile-surface { position: relative; }
.ckd-tile-canvas { position: absolute; inset: 0; }
.ckd-tile-pane { position: absolute; outline: none; }
```

- [ ] **Step 3: Register the demo**

In `apps/site/registry.ts`, add to `DEMO_META` in the Foundations group, after the
`gestures` entry:

```ts
  {
    id: 'tiled-surface',
    title: 'Tiled surface',
    category: 'Foundations',
    description: 'Two independent scenes, two cameras, one WebGL context. Each `<SceneCanvas>` paints into a rect of one host-owned canvas via `paintInto` and takes pointer input from its own transparent box via `inputElement`. `WeaselRenderer.setTarget()` sets the viewport and scissor per frame, so each pane’s frame clear stops at its own edge instead of erasing its neighbour. Each pane gets its own `<WeaselProvider isolate>` — a shared `<ActionsProvider>` lets only the newest canvas under it respond to input.',
    hint: 'Drag a rectangle in either pane. The right pane is at 2× zoom and panned, so its drags move half as far in world units.',
    load: () => import('./demos/TiledSurfaceDemo').then((m) => m.TiledSurfaceDemo),
    path: 'apps/site/demos/TiledSurfaceDemo.tsx',
  },
```

- [ ] **Step 4: Delete the spike page**

```bash
git rm apps/site/spike-arc2.html apps/site/spike-arc2.tsx
```

- [ ] **Step 5: Look at it**

Run: `npx vite --config vite.config.ts --port 5177` and open
`http://localhost:5177/weasel/#tiled-surface`.

Expected: two panes side by side on one grey canvas, blue-tinted left and cream
right, each with a coloured rectangle. The right pane's rectangle is twice the size
of the left's, and its red mark is clipped off at the pane's right edge. Drag a
rectangle in each: neither drag disturbs the other pane. **Screenshot it** — jsdom
cannot see a layout collapse (CLAUDE.md, Traps).

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit && npm run lint`

Expected: no output from either.

- [ ] **Step 7: Commit**

```bash
git add apps/site/demos/TiledSurfaceDemo.tsx apps/site/registry.ts apps/site/canvas-kit-demo.css
git commit -m "add a tiled-surface demo and retire the spike page"
```

---

### Task 8: Real-GL guard — the scissor confines the frame clear

The spec names this the load-bearing test: two tiles in one context, and without a
scissored clear one pane's even-odd fill leaks into its neighbour. Steps 3 and 4
break the implementation deliberately and confirm the test notices. Do not skip them
— a guard test that has never been seen red is an assertion about the harness.

**Files:**
- Create: `tests/visual/tiled-surface.spec.ts`

- [ ] **Step 1: Write the test**

Create `tests/visual/tiled-surface.spec.ts`:

```ts
/**
 * Real-GL guard for `WeaselRenderer.setTarget()`. No committed baseline: GL
 * rasterization is not byte-identical across drivers, so this asserts
 * containment invariants by probing pixels instead of diffing an image.
 *
 * The claim is that each pane's frame clear stops at its own rect. Two panes
 * paint into one buffer with two different background colours; if either
 * clear escaped its scissor, one background would cover both panes, and the
 * gutters between and around them would stop being the page's own grey.
 */
import { test, expect } from '@playwright/test';

/** Reads the shared surface back through a 2D canvas so pixels can be probed.
 *  The GL canvas is created with `preserveDrawingBuffer: true`, so drawing it
 *  into a 2D context after the frame lands is well-defined. */
const probe = (points: Record<string, [number, number]>) => `
  (() => {
    const src = document.querySelector('[data-testid="tiled-surface"]');
    const off = document.createElement('canvas');
    off.width = src.width; off.height = src.height;
    const ctx = off.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const dpr = src.width / parseFloat(src.style.width);
    const at = (x, y) => Array.from(
      ctx.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data
    );
    const pts = ${JSON.stringify(points)};
    const out = {};
    for (const k of Object.keys(pts)) out[k] = at(pts[k][0], pts[k][1]);
    return out;
  })()
`;

const near = (got: number[], want: [number, number, number], tol = 3) => {
  for (let i = 0; i < 3; i++) expect(Math.abs(got[i] - want[i])).toBeLessThanOrEqual(tol);
};

test('tiled-surface — each pane clears only its own rect', async ({ page }) => {
  await page.goto('/#tiled-surface');
  await page.waitForTimeout(600);

  // Pane A is #e8f0fb at CSS (20,20)-(400,380); pane B is #fdf3d8 at
  // (420,20)-(800,380). The gutter between them is never painted by either.
  const px = await page.evaluate(probe({
    paneA: [200, 200],
    paneB: [600, 300],
    gutter: [410, 200],
    aboveA: [200, 8],
    farRight: [812, 200],
  }));

  near(px.paneA, [0xe8, 0xf0, 0xfb]);
  near(px.paneB, [0xfd, 0xf3, 0xd8]);

  // The three unpainted probes must be fully transparent. A clear that escaped
  // its scissor writes the renderer's clear colour over them — which is also
  // transparent — so alpha alone would not catch it; the two pane probes above
  // are what distinguish "each cleared its own rect" from "one cleared both".
  expect(px.gutter[3]).toBe(0);
  expect(px.aboveA[3]).toBe(0);
  expect(px.farRight[3]).toBe(0);
});

test('tiled-surface — a pane clips its content at its own edge', async ({ page }) => {
  await page.goto('/#tiled-surface');
  await page.waitForTimeout(600);

  // Pane B's 'mark' node sits at world (180,150) with its camera at 2x panned
  // (-40,-30) — pane-local (440,360), past the pane's 380x360 box. Without the
  // scissor it would paint #c0392b into pane A's neighbour territory and the
  // gutter. Probing right of pane B's edge catches exactly that.
  const px = await page.evaluate(probe({
    beyondB: [806, 340],
    insideBEdge: [795, 340],
  }));

  expect(px.beyondB[3]).toBe(0);
  // Just inside pane B is still its background, not the mark.
  near(px.insideBEdge, [0xfd, 0xf3, 0xd8]);
});

test('tiled-surface — an even-odd hole stays a hole in both panes', async ({ page }) => {
  await page.goto('/#tiled-surface');
  await page.waitForTimeout(600);

  // The 'ring' node is filled even-odd, so it goes through
  // `drawPathFillStencil` and uses stencil bit 0. Its hole is only a hole
  // while each pane's stencil state is its own. Pane A: pose (40,180) 100x100
  // at 1x, pane origin (20,20) — hole spans CSS (85,225)-(135,275). Pane B:
  // same pose at 2x panned (-40,-30), pane origin (420,20) — the ring covers
  // local (160,420)+, which is below the pane, so only pane A is probed for
  // the hole and pane B is probed for the ring body being drawn at all.
  const px = await page.evaluate(probe({
    aHole: [110, 250],
    aRingBody: [65, 250],
  }));

  // The hole shows the pane's own background through it.
  near(px.aHole, [0xe8, 0xf0, 0xfb]);
  // The ring body is the purple fill, not the background.
  near(px.aRingBody, [0x6b, 0x4c, 0x9a]);
});
```

- [ ] **Step 2: Run it and watch it pass**

Run: `npx playwright test --config=tests/visual/playwright.config.ts tiled-surface`

Expected: 3 passed. If the third fails, the ring's probe coordinates are wrong for
what the demo actually draws — screenshot the surface and read the real geometry off
it before touching the renderer.

- [ ] **Step 3: Break the scissor and watch it fail**

In `WeaselRenderer.ts`, in `applyTarget()`, temporarily comment out the two lines:

```ts
    // gl.scissor(x, y, w, h);
    // gl.enable(gl.SCISSOR_TEST);
```

Run: `npx playwright test --config=tests/visual/playwright.config.ts tiled-surface`

Expected: **FAIL.** Whichever pane paints second clears the whole buffer, so `paneA`
comes back as pane B's cream (or the gutter probes come back opaque). If it PASSES,
stop: the test is asserting nothing and needs fixing before the guard is worth
keeping.

- [ ] **Step 4: Restore and re-run**

Uncomment both lines.

Run: `npx playwright test --config=tests/visual/playwright.config.ts tiled-surface`

Expected: 3 passed.

- [ ] **Step 5: Settle whether the stencil clear is load-bearing, and say so**

The spec claims the guard is a stencil leak: one pane's even-odd fill reading bits
its neighbour left set. That may not be reachable. `drawPathFillStencil` narrows to
`stencilMask(0x01)` and clears bit 0 *after* its own fill (`renderer/draw.ts`, near
the end of the function), so the even-odd path already cleans up after itself, and
the frame's stencil clear may be redundant belt-and-braces.

Find out rather than assume. In `render()`, temporarily change the clear to colour
only:

```ts
      gl.clear(gl.COLOR_BUFFER_BIT);
```

Run: `npx playwright test --config=tests/visual/playwright.config.ts tiled-surface`

- **If it FAILS:** the stencil clear is load-bearing. Restore the line, and note in
  the spec's arc 1 section which probe caught it.
- **If it PASSES:** the stencil clear is not what protects the even-odd fill —
  bit 0's self-clean is. Restore the line anyway (a clip left mid-frame by a throw
  would still need it), and **correct the spec**: replace the sentence in "Testing
  traps" claiming the load-bearing test is a stencil leak with what the guard
  actually catches, which is the frame clear escaping its scissor. Do not leave a
  test in place implying it covers a leak it cannot see.

Either way, restore the line before moving on and re-run to confirm 3 passed.

- [ ] **Step 6: Run the whole visual suite**

Run: `npx playwright test --config=tests/visual/playwright.config.ts`

Expected: 42 passed, 3 skipped, 1 failed. The one failure is
`lab-loupe.spec.ts:115` ("the DOM lens re-renders the instrument bigger"), which
fails identically on a clean tree and is not this work. If anything else is red, it
is yours.

- [ ] **Step 7: Commit**

```bash
git add tests/visual/tiled-surface.spec.ts docs/superpowers/specs/2026-09-02-labkit-annotations-design.md
git commit -m "guard that a targeted renderer clears only its own rect"
```

---

### Task 9: Price N renderers on one context against one renderer resized

This answers the spec's open question. It **reports and does not gate** — the
convention for `tests/perf` (see `tests/bench/README.md`). It is a measurement, so
its output is the deliverable; do not turn a number into a threshold.

**Files:**
- Create: `tests/perf/tiled-surface.spec.ts`

- [ ] **Step 1: Write the measurement**

Create `tests/perf/tiled-surface.spec.ts`:

```ts
/**
 * What N renderers on one context cost against one renderer moved between
 * panes. Mesh, texture and gradient-ramp caches are per-renderer, so N
 * renderers hold N copies of every uploaded mesh and glyph atlas on the same
 * context — the question is whether the per-frame cost of re-targeting one
 * renderer is cheaper than that duplication.
 *
 * Reports; does not gate. See tests/bench/README.md.
 */
import { test } from '@playwright/test';

const FRAMES = 120;

test('tiled-surface — buffer uploads and frame time, N renderers vs one', async ({ page }) => {
  await page.goto('/#tiled-surface');
  await page.waitForTimeout(600);

  // Count real GPU uploads by wrapping the live context. Two panes drawing the
  // same two node shapes should upload each mesh once per renderer.
  const measured = await page.evaluate(async (frames) => {
    const c = document.querySelector('[data-testid="tiled-surface"]') as HTMLCanvasElement;
    const gl = c.getContext('webgl2')!;
    let uploads = 0;
    let uploadedBytes = 0;
    const realBufferData = gl.bufferData.bind(gl);
    (gl as unknown as { bufferData: unknown }).bufferData = (...args: unknown[]) => {
      uploads++;
      const src = args[1];
      if (ArrayBuffer.isView(src)) uploadedBytes += (src as ArrayBufferView).byteLength;
      else if (typeof src === 'number') uploadedBytes += src;
      return (realBufferData as (...a: unknown[]) => unknown)(...args);
    };

    // Force repaints by nudging the camera through the pane's own input box,
    // which is the only surface that drives a frame here.
    const pane = document.querySelector('[data-pane="B"]') as HTMLElement;
    const r = pane.getBoundingClientRect();
    const t0 = performance.now();
    for (let i = 0; i < frames; i++) {
      pane.dispatchEvent(new PointerEvent('pointermove', {
        clientX: r.left + 100 + (i % 20), clientY: r.top + 100, bubbles: true,
      }));
      await new Promise((res) => requestAnimationFrame(() => res(null)));
    }
    const elapsed = performance.now() - t0;

    (gl as unknown as { bufferData: unknown }).bufferData = realBufferData;
    return { uploads, uploadedBytes, elapsed, frames };
  }, FRAMES);

  // One line per measurement as it lands — a silent harness is
  // indistinguishable from a hung one.
  console.log(`  frames                 ${measured.frames}`);
  console.log(`  wall clock             ${measured.elapsed.toFixed(1)} ms`);
  console.log(`  per frame              ${(measured.elapsed / measured.frames).toFixed(3)} ms`);
  console.log(`  bufferData calls       ${measured.uploads}`);
  console.log(`  bytes uploaded         ${measured.uploadedBytes}`);
  console.log(`  per frame (uploads)    ${(measured.uploads / measured.frames).toFixed(2)}`);
});
```

- [ ] **Step 2: Run it and read the numbers**

Run: `npx playwright test --config=tests/perf/playwright.config.ts tiled-surface`

Expected: 1 passed, with six numbers printed. There is no assertion — the point is
the figures.

- [ ] **Step 3: Record the answer in the spec**

In `docs/superpowers/specs/2026-09-02-labkit-annotations-design.md`, replace this
line in the "Open" section:

```markdown
- Whether one `WeaselRenderer` resized per pane beats N renderers on one context
  (arc 1). The spike ran N, which works but duplicates every cache per pane.
```

with a statement of what you measured — the per-frame cost, the upload count, and
which way it points — moved up into the arc 1 section, since it is no longer open.
Two sentences. If the numbers do not settle it, say that instead and leave the
question in "Open" with the figures attached.

- [ ] **Step 4: Commit**

```bash
git add tests/perf/tiled-surface.spec.ts docs/superpowers/specs/2026-09-02-labkit-annotations-design.md
git commit -m "price N renderers on one context against one retargeted"
```

---

### Task 10: Changeset and close-out

**Files:**
- Create: `.changeset/renderer-target-rect.md`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Write the changeset**

`patch` — always, in this repo, whatever the change does. See CLAUDE.md, "Releases:
always write `patch`". **Do not write a `bump-approved` marker.**

Create `.changeset/renderer-target-rect.md`:

```markdown
---
'@weasel-js/core': patch
---

`WeaselRenderer` can draw into a rect of a buffer it does not own.
`setTarget({ origin, clear })` applies a viewport and scissor inside `render()`,
so N renderers can share one WebGL context and one canvas without a frame clear
erasing a co-tenant. The rect's size is the renderer's own `width`/`height`.

Adds API. Two behaviour changes for existing callers: `render()` now
re-establishes blend, depth, cull and clear colour every frame instead of once at
construction, so a co-tenant moving that state no longer corrupts weasel's
frames; and the constructor now throws when handed a WebGL2 context whose
attributes report no stencil buffer, which previously rendered clips and even-odd
fills wrong instead of failing.
```

- [ ] **Step 2: Check the bump gate**

Run: `npm run check:bumps`

Expected: passes.

- [ ] **Step 3: Retire the TODO entry, if there is one**

Run: `grep -n "target rect\|tiled\|scissor" docs/TODO.md`

If an entry covers this work, delete it or rewrite it around what is left — and fix
the hand-maintained index at the top of the file in the same edit. If nothing
matches, skip this step.

- [ ] **Step 4: Full gate**

Run: `npx tsc --noEmit && npm run lint && npx vitest run --project=kit`

Expected: no output from the first two; all kit tests pass. Run this in the
foreground and read the pass count — a backgrounded run has reported exit 0 over a
real failure.

- [ ] **Step 5: Commit**

```bash
git add .changeset/renderer-target-rect.md docs/TODO.md
git commit -m "changeset for the renderer target rect"
```

---

## What this plan does not do

- **Arc 2** — `paintInto` / `inputElement` on `<Canvas>` stay as the spike left them,
  labelled SPIKE. Task 6 only repoints the call. Arc 2 gives them their real shape:
  widening `canvasRef` to `HTMLElement` instead of casting through it, deciding what
  `CanvasExtensionApi.element` means when paint and input are two elements, and
  restoring the HUDs, which currently drop when detached.
- **Deciding N-vs-1.** Task 9 measures; changing the architecture on the answer is
  its own work.
