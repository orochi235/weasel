# Nested Clipping (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add nested-clipping support to the kit. `ContainerNode.clipFromPose?` provides a clip path; the renderer rasterizes it into the stencil buffer (one bit per nesting level, max 7); descendants paint only where all ancestor clips intersect; hit-test mirrors the same logic.

**Architecture:** Stencil bit-partitioning — bit 0 stays with existing path-stencil code (evenodd, stroke align); bits 1–7 hold one bit per clip level. Single-pass push/pop. Hit-test walks the tree clip-aware via a new `walkClipAware` helper in `sceneToAdapter`. Phase 1 (hierarchical scene rendering) is already shipped; Phase 2 attaches `clip` to the wrapper groups Phase 1 emits.

**Tech Stack:** TypeScript, WebGL stencil ops, vitest, the existing weasel scene + renderer.

**Spec:** `docs/superpowers/specs/2026-05-10-nested-clipping-phase-2-design.md`

---

## File map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/core/scene/types.ts` | Modify | Add `clipFromPose?` to `ContainerNode` |
| `src/renderer/DrawCommand.ts` | Modify | Add `clip?: Path` to `GroupDrawCommand` |
| `src/canvas/buildSceneTree.ts` | Modify | Attach `clip` to wrapper groups when container has `clipFromPose` |
| `src/canvas/buildSceneTree.test.ts` | Modify | Cover the new clip attachment cases |
| `src/renderer/draw.ts` | Modify | Narrow existing path-stencil to bit 0; add `pushClip` / `popClip` / clip-aware `drawGroup` / per-fragment clip test helper |
| `src/renderer/draw.test.ts` | Modify | Bit-narrowing audit, clip push/pop sequence, depth-limit throw, nested clip integration |
| `src/features/paths/pathHitTest.ts` | Create | `pathContainsPoint`, `pathContainsRect`, `pathIntersectsRect`, `pathContainsPolygon`, `pathIntersectsPolygon` (rect + polygon path kinds only; bezier doesn't exist yet) |
| `src/features/paths/pathHitTest.test.ts` | Create | Test all 5 helpers across both path kinds and both fill rules |
| `src/canvas/sceneAdapter.ts` | Modify | Replace flat `hitTestArea` / `hitTestLasso` with `walkClipAware` |
| `src/canvas/sceneAdapter.test.ts` | Modify | Add clip-aware hit-test cases |
| `src/tools/builtin/useSelectTool.ts` | Modify | Default `pickEvery` fallback uses `walkClipAware` instead of flat AABB scan |
| `src/tools/builtin/useSelectTool.test.tsx` (or where the default fallback is currently tested) | Modify | Cover clip-aware default `pickEvery` |
| `demo/demos/ClippingDemo.tsx` | Create | Canonical demo: container with elliptical clip, two overhanging children |
| `demo/registry.ts` | Modify | Register `ClippingDemo` in the sidebar |

---

## Task 1: Type additions

**Files:**
- Modify: `src/core/scene/types.ts`
- Modify: `src/renderer/DrawCommand.ts`

Pure type additions — no runtime behavior yet. Tests come in later tasks when the types are consumed.

- [ ] **Step 1: Read the existing types**

Read `src/core/scene/types.ts` for `ContainerNode`. Read `src/renderer/DrawCommand.ts` for `GroupDrawCommand`. Read `src/features/paths/types.ts` for `Path`. Confirm `Path` is `PolygonPath | RectPath` (no bezier).

- [ ] **Step 2: Add `clipFromPose?` to `ContainerNode`**

In `src/core/scene/types.ts`, extend `ContainerNode`:

```ts
export interface ContainerNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'container';
  children: NodeId[];
  /** Optional clip-path source. Re-evaluated each render. Returning `null`
   *  means "no clip for this container right now"; an empty / zero-area path
   *  means "clip everything out" (children render nowhere). When set, the
   *  renderer rasterizes the returned path into the stencil buffer and
   *  paints descendants only where it covers. Phase 2 of nested clipping. */
  clipFromPose?: (pose: TPose) => import('features/paths/types').Path | null;
}
```

(If the file already imports `Path` at the top, drop the inline `import(...)` and use the imported name. Read the existing imports.)

- [ ] **Step 3: Add `clip?: Path` to `GroupDrawCommand`**

In `src/renderer/DrawCommand.ts`, extend `GroupDrawCommand`:

```ts
export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
  colorMatrix?: number[];
  /** Optional clip path. When set, the renderer rasterizes this path into
   *  the stencil buffer before drawing `children`; the children paint only
   *  where the clip covers. Nested groups with clips intersect — a child
   *  cannot escape an ancestor's clip. Max 7 nesting levels; the renderer
   *  throws if exceeded. Phase 2 of nested clipping. */
  clip?: Path;
  children: DrawCommand[];
}
```

(`Path` may need to be imported at the top of the file; check the existing imports.)

- [ ] **Step 4: Typecheck**

```
npx tsc --noEmit
```

Expected: clean. No tests yet — type additions don't break anything.

- [ ] **Step 5: Commit**

```bash
git add src/core/scene/types.ts src/renderer/DrawCommand.ts
git commit -m "feat(types): clipFromPose on ContainerNode, clip on GroupDrawCommand"
```

---

## Task 2: `buildSceneTree` clip attachment

**Files:**
- Modify: `src/canvas/buildSceneTree.ts`
- Modify: `src/canvas/buildSceneTree.test.ts`

`buildNodeGroup` should attach `clip` to the wrapper group when the container has `clipFromPose` and it returns a non-null path.

- [ ] **Step 1: Read the current `buildSceneTree`**

Read `src/canvas/buildSceneTree.ts`. Note `buildNodeGroup` — it currently returns `{ kind: 'group', children }` unconditionally.

- [ ] **Step 2: Write failing tests**

Add to `src/canvas/buildSceneTree.test.ts`:

```ts
it('container with clipFromPose returning a path → group has clip field set', () => {
  const scene = makeScene();
  const clipPath: import('../features/paths/types').Path = {
    kind: 'rect', x: 0, y: 0, width: 50, height: 50,
  };
  const bed = scene.add({
    kind: 'container',
    layer: 'bg',
    pose: POSE,
    data: { label: 'bed' },
    clipFromPose: () => clipPath,
  } as never);  // `as never` because the scene type still has the layered ts typing
  scene.add({ kind: 'leaf', layer: 'bg', pose: POSE, data: { label: 'p' }, parent: bed });
  const adapter = sceneToAdapter(scene);
  const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
  const bgGroup = out[0] as { children: DrawCommand[] };
  const bedGroup = bgGroup.children[0] as { kind: string; clip?: unknown; children: DrawCommand[] };
  expect(bedGroup.clip).toBe(clipPath);
});

it('container with clipFromPose returning null → group has no clip field', () => {
  const scene = makeScene();
  scene.add({
    kind: 'container', layer: 'bg', pose: POSE, data: { label: 'bed' },
    clipFromPose: () => null,
  } as never);
  const adapter = sceneToAdapter(scene);
  const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
  const bedGroup = (out[0] as { children: DrawCommand[] }).children[0] as { clip?: unknown };
  expect(bedGroup.clip).toBeUndefined();
});

it('container without clipFromPose → group has no clip field', () => {
  const scene = makeScene();
  scene.add({ kind: 'container', layer: 'bg', pose: POSE, data: { label: 'bed' } });
  const adapter = sceneToAdapter(scene);
  const out = buildSceneTree(adapter as never, labelDraw as never, VIEW);
  const bedGroup = (out[0] as { children: DrawCommand[] }).children[0] as { clip?: unknown };
  expect(bedGroup.clip).toBeUndefined();
});

it('clipFromPose is called with the live pose, not a stale value', () => {
  const scene = makeScene();
  let received: typeof POSE | null = null;
  scene.add({
    kind: 'container', layer: 'bg', pose: POSE, data: { label: 'bed' },
    clipFromPose: (pose) => { received = pose; return null; },
  } as never);
  const adapter = sceneToAdapter(scene);
  buildSceneTree(adapter as never, labelDraw as never, VIEW);
  expect(received).toEqual(POSE);
});
```

- [ ] **Step 3: Run to verify failures**

```
npx vitest run src/canvas/buildSceneTree.test.ts -t "clip"
```

Expected: FAIL on the first two tests (the third currently passes — no clipFromPose means no clip — but that's fine; it'll keep passing).

- [ ] **Step 4: Implement clip attachment**

In `src/canvas/buildSceneTree.ts`, modify `buildNodeGroup`:

```ts
function buildNodeGroup(id: string): GroupDrawCommand {
  const node = adapter.getNode(id);
  if (!node) return { kind: 'group', children: [] };
  const pose = adapter.getPose(id);
  const self = drawOne(node, pose, view);
  const childIds = adapter.getChildren(id);
  const children: DrawCommand[] = [...self];
  for (const cid of childIds) children.push(buildNodeGroup(cid));

  const group: GroupDrawCommand = { kind: 'group', children };
  // NEW: attach clip when the container provides one
  const maybeContainer = node as { kind?: string; clipFromPose?: (pose: TPose) => unknown };
  if (maybeContainer.kind === 'container' && typeof maybeContainer.clipFromPose === 'function') {
    const clip = maybeContainer.clipFromPose(pose);
    if (clip) group.clip = clip as GroupDrawCommand['clip'];
  }
  return group;
}
```

- [ ] **Step 5: Run all clip tests**

```
npx vitest run src/canvas/buildSceneTree.test.ts -t "clip"
```

Expected: ALL PASS.

- [ ] **Step 6: Run the full file**

```
npx vitest run src/canvas/buildSceneTree.test.ts
```

Expected: ALL PASS — the existing 6 tests should be unaffected.

- [ ] **Step 7: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/canvas/buildSceneTree.ts src/canvas/buildSceneTree.test.ts
git commit -m "feat(canvas): buildSceneTree attaches clipFromPose result to wrapper groups"
```

---

## Task 3: Narrow existing path-stencil to bit 0

**Files:**
- Modify: `src/renderer/draw.ts`
- Modify: `src/renderer/draw.test.ts`

Path-stencil code today uses `stencilMask(0xFF)` and `stencilFunc(..., 0xFF)` — effectively owning all 8 bits. Phase 2 needs bits 1–7 for clip levels. Narrow the masks to `0x01` so existing path code doesn't trample clip-level bits. Verify with a test that simulates pre-set clip bits surviving a path-fill operation.

- [ ] **Step 1: Read the existing stencil code**

Read `src/renderer/draw.ts` around lines 447 (`drawPathFillStencil`) and 518 (`drawPathStrokeStenciled`). Find every `0xff` / `0xFF` and `gl.clear(STENCIL_BUFFER_BIT)` call in these two functions.

- [ ] **Step 2: Write the failing audit test**

Look at `src/renderer/draw.test.ts` for the existing stencil-recorder pattern (already used to test evenodd two-pass). Add to that describe block:

```ts
it('drawPathFillStencil only touches bit 0 — clip-level bits 1-7 survive', () => {
  // Simulate stencil state with bit 2 set (one of the clip-level bits).
  // The recorder verifies that no stencilMask or clear writes outside bit 0.
  const recorder = createRecorderCtx();
  // Build a minimal evenodd path fill command (re-use whatever helper exists).
  const cmd = {
    kind: 'path' as const,
    path: { kind: 'polygon' as const, points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] },
    fill: { color: '#fff' },
  };
  // Force the evenodd stencil path (the dispatcher picks it based on fill rule
  // or polygon kind — check the existing two-pass test for the right setup).
  drawPathFillStencil(recorder, cmd.fill, /* handle */ ...);
  const stencilWrites = recorder.calls.filter((c) =>
    c.name === 'stencilMask' || c.name === 'clear'
  );
  // Every stencilMask should be 0x01, never 0xff or anything wider.
  for (const call of stencilWrites.filter((c) => c.name === 'stencilMask')) {
    expect(call.args[0]).toBe(0x01);
  }
});
```

The exact shape depends on the existing recorder pattern — read it and adapt. The point is: every `stencilMask` call inside `drawPathFillStencil` should be `0x01`, never `0xFF`.

If the existing tests already assert specific `stencilMask` / `stencilFunc` values with `0xFF`, those tests will fail when the narrowing lands — they need updating too. That's expected and not a regression.

- [ ] **Step 3: Run to verify failure**

```
npx vitest run src/renderer/draw.test.ts -t "evenodd"
```

Plus any test that asserts on `0xff` in stencil calls. Expected: existing assertions about `0xff` still pass; the new audit test fails.

- [ ] **Step 4: Narrow `drawPathFillStencil`**

In `src/renderer/draw.ts`, in `drawPathFillStencil`:

```ts
// BEFORE:
gl.stencilMask(0xff);
gl.stencilFunc(gl.ALWAYS, 0, 0xff);
gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
// ... draw ...
gl.stencilFunc(gl.NOTEQUAL, 0, 0xff);
gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
// ... shaded draw ...
gl.clear(gl.STENCIL_BUFFER_BIT);

// AFTER:
gl.stencilMask(0x01);
gl.stencilFunc(gl.ALWAYS, 0, 0x01);
gl.stencilOp(gl.KEEP, gl.KEEP, gl.INVERT);
// ... draw ...
gl.stencilFunc(gl.NOTEQUAL, 0, 0x01);
gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
// ... shaded draw ...
gl.stencilMask(0x01);                // re-narrow before clear so we only wipe bit 0
gl.clear(gl.STENCIL_BUFFER_BIT);
```

Read the current code carefully — there may be `stencilMask` calls between the ones shown above. Narrow every one.

- [ ] **Step 5: Narrow `drawPathStrokeStenciled`**

Same pattern. Every `0xff` → `0x01`. The clear at the end (if any) also gets the explicit `gl.stencilMask(0x01)` immediately before.

- [ ] **Step 6: Update existing tests that asserted `0xff`**

Any test that does `expect(call.args[0]).toBe(0xff)` for a stencilMask or stencilFunc inside the path-stencil paths now expects `0x01`. Update them.

- [ ] **Step 7: Run the renderer test file**

```
npx vitest run src/renderer/draw.test.ts
```

Expected: ALL PASS — both the updated existing tests and the new audit test.

- [ ] **Step 8: Run the full kit suite**

```
npx vitest run
```

Expected: same as before plus the new test. No regressions.

- [ ] **Step 9: Commit**

```bash
git add src/renderer/draw.ts src/renderer/draw.test.ts
git commit -m "refactor(renderer): narrow path-stencil to bit 0 (reserve bits 1-7 for clip levels)"
```

---

## Task 4: `pushClip` and `popClip` primitives

**Files:**
- Modify: `src/renderer/draw.ts`
- Modify: `src/renderer/draw.test.ts`

Add the two helpers in isolation, with their GL call sequences fully testable via the recorder pattern. No `drawGroup` integration yet — that's Task 5.

- [ ] **Step 1: Sketch the math**

For `pushClip(path, newDepth)` (where `newDepth` is the depth AFTER the push):
- `ancestors = ancestorMask(newDepth - 1)` = bits 1..(newDepth-1); 0 when newDepth === 1.
- `newBit = 1 << newDepth`.
- `ref = ancestors | newBit` — the bit pattern shared by stencilFunc and stencilOp.
- stencilFunc: `EQUAL`, `ref = ancestors | newBit`, `mask = ancestors` — passes where all ancestor bits are set (newBit ignored for the test because it's outside the mask).
- stencilMask: `newBit` — only newBit is written.
- stencilOp: `KEEP, KEEP, REPLACE` — passing pixels get `(ref & stencilMask) | (old & ~stencilMask) = newBit | old`. The newBit flips on; ancestors preserved.

For `popClip(path, oldDepth)`:
- `oldBit = 1 << (oldDepth + 1)` — the bit we're clearing.
- `ref = ancestorMask(oldDepth) | oldBit` — match pixels we set on push.
- stencilFunc: `EQUAL`, `ref`, mask `ref` — pass where all those bits are set.
- stencilMask: `oldBit` — only touch the bit we're clearing.
- stencilOp: `KEEP, KEEP, ZERO` — clears the masked bit in passing pixels.

Add a private helper:

```ts
function ancestorMask(depth: number): number {
  // bits 1..depth (inclusive). depth=0 → 0; depth=3 → 0b00001110 = 0x0E.
  return depth === 0 ? 0 : ((1 << (depth + 1)) - 1) & 0xFE;
}
```

- [ ] **Step 2: Write failing tests**

Add to `src/renderer/draw.test.ts`:

```ts
describe('pushClip / popClip', () => {
  it('pushClip(level=1): sets bit 1 wherever the clip path covers, no ancestor test needed', () => {
    const recorder = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    pushClip(recorder, path, /* newDepth */ 1);
    const calls = recorder.calls;
    // stencilMask should be 0x02 (bit 1) for the write
    expect(calls.find((c) => c.name === 'stencilMask' && c.args[0] === 0x02)).toBeDefined();
    // stencilFunc EQUAL ref=0x02 mask=0x00 (no ancestors at depth 1)
    const sf = calls.find((c) => c.name === 'stencilFunc');
    expect(sf!.args).toEqual([recorder.gl.EQUAL, 0x02, 0x00]);
    // stencilOp KEEP KEEP REPLACE
    const so = calls.find((c) => c.name === 'stencilOp');
    expect(so!.args).toEqual([recorder.gl.KEEP, recorder.gl.KEEP, recorder.gl.REPLACE]);
    // colorMask false then true (stencil-only pass)
    const cmCalls = calls.filter((c) => c.name === 'colorMask');
    expect(cmCalls[0].args).toEqual([false, false, false, false]);
    expect(cmCalls[cmCalls.length - 1].args).toEqual([true, true, true, true]);
  });

  it('pushClip(level=3): only writes bit 3 where bits 1+2 are already set', () => {
    const recorder = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    pushClip(recorder, path, /* newDepth */ 3);
    const sf = recorder.calls.find((c) => c.name === 'stencilFunc');
    // ref includes bits 1, 2, 3 (=0x0E); mask is ancestors only (bits 1+2 = 0x06)
    expect(sf!.args).toEqual([recorder.gl.EQUAL, 0x0E, 0x06]);
    const sm = recorder.calls.find((c) => c.name === 'stencilMask' && c.args[0] !== 0x01);
    expect(sm!.args).toEqual([0x08]);  // bit 3
  });

  it('popClip(oldDepth=2): clears bit 3 along the path, preserves ancestor bits', () => {
    const recorder = createRecorderCtx();
    const path = { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 };
    popClip(recorder, path, /* oldDepth */ 2);
    // ref = ancestorMask(2) | (1 << 3) = 0x06 | 0x08 = 0x0E
    const sf = recorder.calls.find((c) => c.name === 'stencilFunc');
    expect(sf!.args).toEqual([recorder.gl.EQUAL, 0x0E, 0x0E]);
    // stencilMask = bit 3 only
    const sm = recorder.calls.find((c) => c.name === 'stencilMask' && c.args[0] !== 0x01);
    expect(sm!.args).toEqual([0x08]);
    // stencilOp ZERO for the write
    const so = recorder.calls.find((c) => c.name === 'stencilOp');
    expect(so!.args).toEqual([recorder.gl.KEEP, recorder.gl.KEEP, recorder.gl.ZERO]);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```
npx vitest run src/renderer/draw.test.ts -t "pushClip / popClip"
```

Expected: FAIL — `pushClip` / `popClip` don't exist yet.

- [ ] **Step 4: Implement**

In `src/renderer/draw.ts`, add the helper and two new functions. Place them near the existing stencil helpers (after `drawPathStrokeStenciled`).

```ts
function ancestorMask(depth: number): number {
  return depth === 0 ? 0 : ((1 << (depth + 1)) - 1) & 0xFE;
}

/** Push a clip level. Rasterizes the clip path into the stencil buffer,
 *  setting bit `newDepth` where (a) the path's fragment passes AND (b) all
 *  ancestor clip bits are already set. */
function pushClip(ctx: DrawContext, path: Path, newDepth: number): void {
  const gl = ctx.gl;
  const ancestors = ancestorMask(newDepth - 1);
  const newBit = 1 << newDepth;
  const ref = ancestors | newBit;

  gl.enable(gl.STENCIL_TEST);
  gl.colorMask(false, false, false, false);
  gl.stencilMask(newBit);
  gl.stencilFunc(gl.EQUAL, ref, ancestors);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE);

  // Rasterize the clip path via the existing path-fill pipeline.
  // Reuse the same tessellation + drawElements that drawPathFillStencil uses,
  // minus the shaded pass — we only want the stencil write here.
  rasterizePathToStencil(ctx, path);

  gl.colorMask(true, true, true, true);
}

/** Pop a clip level. Rasterizes the same path again, clearing bit
 *  `oldDepth + 1` where it was set during the matching push. */
function popClip(ctx: DrawContext, path: Path, oldDepth: number): void {
  const gl = ctx.gl;
  const oldBit = 1 << (oldDepth + 1);
  const ref = ancestorMask(oldDepth) | oldBit;

  gl.colorMask(false, false, false, false);
  gl.stencilMask(oldBit);
  gl.stencilFunc(gl.EQUAL, ref, ref);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.ZERO);

  rasterizePathToStencil(ctx, path);

  gl.colorMask(true, true, true, true);
}
```

Where `rasterizePathToStencil(ctx, path)` is a small helper extracted from the existing `drawPathFillStencil`. It runs the fill program, sets `setProjAndModel`, binds the mesh handle for `getMesh(path)`, and calls `drawElements`. No shaded pass, no per-vertex color, no fill paint setup. Read the existing `drawPathFillStencil` body and pull out just the geometry-rasterization steps; the rest (colorMask, stencilFunc, stencilOp, stencilMask) is controlled by the caller.

If extracting that helper is messier than expected, an alternative is to inline the same drawElements call inside `pushClip` / `popClip`. Both functions need it; DRY favors extraction.

- [ ] **Step 5: Run the new tests**

```
npx vitest run src/renderer/draw.test.ts -t "pushClip / popClip"
```

Expected: PASS.

- [ ] **Step 6: Run the full renderer file**

```
npx vitest run src/renderer/draw.test.ts
```

Expected: ALL PASS.

- [ ] **Step 7: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/renderer/draw.ts src/renderer/draw.test.ts
git commit -m "feat(renderer): pushClip / popClip primitives for bit-per-level clip stencil"
```

---

## Task 5: `drawGroup` clip integration + depth-limit + per-fragment clip test

**Files:**
- Modify: `src/renderer/draw.ts`
- Modify: `src/renderer/draw.test.ts`

Wire push/pop into `drawGroup`. Add `clipDepth` to the state stack. Add a per-fragment clip test helper that's called before each fragment-producing draw call. Throw on depth > 7.

- [ ] **Step 1: Read current `drawGroup` and state stack**

Read `src/renderer/draw.ts` around `drawGroup` (~line 218) and the `DrawContext.state` push/pop machinery. Find where state is initialized to confirm `clipDepth: 0` belongs.

- [ ] **Step 2: Write failing tests**

```ts
it('drawGroup with cmd.clip pushes clip and children draw under the test', () => {
  const recorder = createRecorderCtx();
  const cmd = {
    kind: 'group' as const,
    clip: { kind: 'rect' as const, x: 0, y: 0, width: 10, height: 10 },
    children: [{ kind: 'path' as const, path: { kind: 'rect' as const, x: 0, y: 0, width: 5, height: 5 }, fill: { color: '#fff' } }],
  };
  drawGroup(recorder, cmd);
  // Find the sequence: stencilMask(0x02) precedes the child path draw,
  // stencilFunc(EQUAL, 0x02, 0x02) is set during the child draw, and
  // a popClip-style stencilOp ZERO appears after children.
  const calls = recorder.calls.map((c) => `${c.name}(${c.args.join(',')})`);
  const idxPushMask = calls.findIndex((s) => s.startsWith('stencilMask(2)'));
  const idxChildTest = calls.findIndex(
    (s, i) => i > idxPushMask && s.startsWith('stencilFunc(') && s.includes(',2,2')
  );
  const idxPop = calls.findIndex(
    (s, i) => i > idxChildTest && s === 'stencilOp(7680,7680,0)' // KEEP, KEEP, ZERO
  );
  expect(idxPushMask).toBeGreaterThanOrEqual(0);
  expect(idxChildTest).toBeGreaterThan(idxPushMask);
  expect(idxPop).toBeGreaterThan(idxChildTest);
});

it('drawGroup without cmd.clip does not touch the stencil', () => {
  const recorder = createRecorderCtx();
  const cmd = {
    kind: 'group' as const,
    children: [{ kind: 'path' as const, path: { kind: 'rect' as const, x: 0, y: 0, width: 5, height: 5 }, fill: { color: '#fff' } }],
  };
  drawGroup(recorder, cmd);
  // The fast rect path may use stencil for evenodd in some configs, but no
  // pushClip / popClip should fire — confirm by absence of stencilMask(0x02)
  // or any bit-1..7 writes.
  const hasClipMaskWrite = recorder.calls.some(
    (c) => c.name === 'stencilMask' && c.args[0] !== 0x01 && c.args[0] !== 0x00 && c.args[0] !== 0xff
  );
  expect(hasClipMaskWrite).toBe(false);
});

it('drawGroup throws at depth 8', () => {
  // Build a chain of 8 nested clip groups.
  let cmd: import('../DrawCommand').GroupDrawCommand = {
    kind: 'group',
    children: [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 }, fill: { color: '#fff' } }],
  };
  for (let i = 0; i < 8; i++) {
    cmd = {
      kind: 'group',
      clip: { kind: 'rect', x: 0, y: 0, width: 10, height: 10 },
      children: [cmd],
    };
  }
  const recorder = createRecorderCtx();
  expect(() => drawGroup(recorder, cmd)).toThrow(/clip nesting depth exceeded \(max 7\)/);
});
```

- [ ] **Step 3: Run to verify failures**

```
npx vitest run src/renderer/draw.test.ts -t "drawGroup"
```

Expected: FAIL on the clip-aware tests.

- [ ] **Step 4: Add `clipDepth` to state stack**

In `src/renderer/draw.ts`, find the state stack init (probably in `WeaselRenderer` or `createDrawContext`). Add `clipDepth: 0` to the initial state. Add it to the push/pop logic too — `state.push` creates a new frame inheriting parent's clipDepth; `state.pop` discards. Read the existing implementation and match its pattern.

- [ ] **Step 5: Add the per-fragment clip test helper**

```ts
/** Set the stencil test for the current clip depth. Called by every
 *  fragment-producing draw before its drawElements call when clipDepth > 0.
 *  At clipDepth = 0, disables STENCIL_TEST (zero-overhead common case). */
function applyClipTest(ctx: DrawContext): void {
  const gl = ctx.gl;
  const depth = ctx.state.clipDepth;
  if (depth === 0) {
    gl.disable(gl.STENCIL_TEST);
    return;
  }
  const mask = ancestorMask(depth);
  gl.enable(gl.STENCIL_TEST);
  gl.stencilFunc(gl.EQUAL, mask, mask);
  gl.stencilOp(gl.KEEP, gl.KEEP, gl.KEEP);
  gl.stencilMask(0x01);  // any subsequent path-stencil work stays in bit 0
}
```

Call this helper at the start of `drawPath` (and any other fragment-producing draw — `drawText`, `drawImage`, the shader-draw path). Read the existing functions and insert the call before the `drawElements` for the shaded pass. For `drawPathFillStencil` (evenodd / stroke alignment), `applyClipTest` should be called immediately before the *shaded* draw, not the stencil-write passes (those need to override stencilFunc themselves; the clip test gets re-applied for the shaded pass).

- [ ] **Step 6: Extend `drawGroup`**

```ts
function drawGroup(ctx: DrawContext, cmd: GroupDrawCommand): void {
  ctx.state.push({
    transform: cmd.transform,
    alpha: cmd.alpha,
    colorMatrix: cmd.colorMatrix,
  });
  if (cmd.clip) {
    const newDepth = ctx.state.clipDepth + 1;
    if (newDepth > 7) {
      throw new Error(
        "weasel: clip nesting depth exceeded (max 7). You can't nest more than 7 levels " +
        "of clipped containers in a single draw tree. Flatten the hierarchy or compose " +
        "poses outside the scene graph."
      );
    }
    pushClip(ctx, cmd.clip, newDepth);
    ctx.state.clipDepth = newDepth;
  }
  for (const child of cmd.children) dispatch(ctx, child);
  if (cmd.clip) {
    popClip(ctx, cmd.clip, ctx.state.clipDepth - 1);
    ctx.state.clipDepth -= 1;
  }
  ctx.state.pop();
}
```

Note: `ctx.state.clipDepth` is mutated directly because `state.push` doesn't deep-copy the depth (it's a number on the top frame). Read the existing state-stack impl to confirm; adapt if needed.

- [ ] **Step 7: Run all new tests**

```
npx vitest run src/renderer/draw.test.ts -t "drawGroup"
```

Expected: PASS for all three.

- [ ] **Step 8: Run the full renderer file**

```
npx vitest run src/renderer/draw.test.ts
```

Expected: ALL PASS — existing tests are unaffected because `clipDepth` starts at 0 and the `applyClipTest` helper is a no-op at depth 0.

- [ ] **Step 9: Run the full kit suite**

```
npx vitest run
```

Expected: same baseline as before plus the new tests.

- [ ] **Step 10: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 11: Commit**

```bash
git add src/renderer/draw.ts src/renderer/draw.test.ts
git commit -m "feat(renderer): drawGroup honors GroupDrawCommand.clip; depth-7 limit; per-fragment clip test"
```

---

## Task 6: Path-hit-test helpers

**Files:**
- Create: `src/features/paths/pathHitTest.ts`
- Create: `src/features/paths/pathHitTest.test.ts`

Five helpers covering rect-path and polygon-path. Reuse existing polygon-vs-rect helpers in `src/features/paths/polygonHitTestRect.ts`.

- [ ] **Step 1: Read existing polygon helpers**

Read `src/features/paths/polygonHitTestRect.ts` to find `polygonContainsRect`, `polygonContainsRectCenter`, `polygonIntersectsRect`. Confirm they accept `points: Point[]` and a `rect: Bounds`. For polygon paths we'll thread their `points` directly; for rect paths we'll write small AABB shims.

- [ ] **Step 2: Write failing tests**

Create `src/features/paths/pathHitTest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  pathContainsPoint,
  pathContainsRect,
  pathIntersectsRect,
  pathContainsPolygon,
  pathIntersectsPolygon,
} from './pathHitTest';
import type { Path } from './types';

const rectPath: Path = { kind: 'rect', x: 0, y: 0, width: 10, height: 10 };
const triPath: Path = {
  kind: 'polygon',
  points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }],
};

describe('pathContainsPoint', () => {
  it('rect path: inside', () => {
    expect(pathContainsPoint(rectPath, 5, 5)).toBe(true);
  });
  it('rect path: outside', () => {
    expect(pathContainsPoint(rectPath, 15, 5)).toBe(false);
  });
  it('rect path: on edge counts as inside', () => {
    expect(pathContainsPoint(rectPath, 0, 0)).toBe(true);
    expect(pathContainsPoint(rectPath, 10, 10)).toBe(true);
  });
  it('polygon path: inside triangle', () => {
    expect(pathContainsPoint(triPath, 5, 3)).toBe(true);
  });
  it('polygon path: outside triangle', () => {
    expect(pathContainsPoint(triPath, 8, 8)).toBe(false);
  });
});

describe('pathContainsRect', () => {
  it('rect path fully contains rect', () => {
    expect(pathContainsRect(rectPath, { x: 2, y: 2, width: 4, height: 4 })).toBe(true);
  });
  it('rect path partially overlaps rect', () => {
    expect(pathContainsRect(rectPath, { x: 8, y: 2, width: 4, height: 4 })).toBe(false);
  });
  it('rect path completely misses rect', () => {
    expect(pathContainsRect(rectPath, { x: 100, y: 100, width: 4, height: 4 })).toBe(false);
  });
  it('polygon path fully contains rect', () => {
    expect(pathContainsRect(triPath, { x: 4, y: 1, width: 2, height: 2 })).toBe(true);
  });
});

describe('pathIntersectsRect', () => {
  it('rect path: rect overlapping → true', () => {
    expect(pathIntersectsRect(rectPath, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });
  it('rect path: rect outside → false', () => {
    expect(pathIntersectsRect(rectPath, { x: 100, y: 100, width: 5, height: 5 })).toBe(false);
  });
  it('polygon path: rect overlapping → true', () => {
    expect(pathIntersectsRect(triPath, { x: 4, y: 5, width: 4, height: 4 })).toBe(true);
  });
});

describe('pathContainsPolygon', () => {
  it('rect path contains triangle', () => {
    const poly = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 5 }];
    expect(pathContainsPolygon(rectPath, poly)).toBe(true);
  });
  it('rect path does not contain triangle that extends outside', () => {
    const poly = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 10, y: 15 }];
    expect(pathContainsPolygon(rectPath, poly)).toBe(false);
  });
});

describe('pathIntersectsPolygon', () => {
  it('rect path intersects polygon that crosses its edge', () => {
    const poly = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 10, y: 15 }];
    expect(pathIntersectsPolygon(rectPath, poly)).toBe(true);
  });
  it('rect path does not intersect polygon entirely outside', () => {
    const poly = [{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 55, y: 60 }];
    expect(pathIntersectsPolygon(rectPath, poly)).toBe(false);
  });
});
```

- [ ] **Step 3: Run to verify failure**

```
npx vitest run src/features/paths/pathHitTest.test.ts
```

Expected: FAIL — module doesn't exist.

- [ ] **Step 4: Implement**

Create `src/features/paths/pathHitTest.ts`:

```ts
import type { Path } from './types';
import {
  polygonContainsRect,
  polygonIntersectsRect,
} from './polygonHitTestRect';

interface Point { x: number; y: number; }
interface Rect { x: number; y: number; width: number; height: number; }

/** Winding-number point-in-polygon test. */
function pointInPolygon(points: readonly Point[], px: number, py: number): boolean {
  let inside = false;
  const n = points.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/** Convex polygon SAT — true iff any axis separates the two convex shapes. */
function polygonContainsPolygon(outer: readonly Point[], inner: readonly Point[]): boolean {
  // All vertices of `inner` must lie inside `outer`.
  for (const p of inner) {
    if (!pointInPolygon(outer, p.x, p.y)) return false;
  }
  return true;
}

function polygonsIntersect(a: readonly Point[], b: readonly Point[]): boolean {
  // Naive edge-vs-edge segment intersection.
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i], a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j], b1 = b[(j + 1) % b.length];
      if (segmentsIntersect(a0, a1, b0, b1)) return true;
    }
  }
  // Or one fully contains the other (no edge crossings).
  if (pointInPolygon(a, b[0].x, b[0].y)) return true;
  if (pointInPolygon(b, a[0].x, a[0].y)) return true;
  return false;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = direction(p3, p4, p1);
  const d2 = direction(p3, p4, p2);
  const d3 = direction(p1, p2, p3);
  const d4 = direction(p1, p2, p4);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0))
      && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSegment(p3, p4, p1)) return true;
  if (d2 === 0 && onSegment(p3, p4, p2)) return true;
  if (d3 === 0 && onSegment(p1, p2, p3)) return true;
  if (d4 === 0 && onSegment(p1, p2, p4)) return true;
  return false;
}

function direction(a: Point, b: Point, c: Point): number {
  return (c.x - a.x) * (b.y - a.y) - (b.x - a.x) * (c.y - a.y);
}

function onSegment(a: Point, b: Point, p: Point): boolean {
  return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x)
      && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
}

function rectToPolygon(r: Rect): Point[] {
  return [
    { x: r.x, y: r.y },
    { x: r.x + r.width, y: r.y },
    { x: r.x + r.width, y: r.y + r.height },
    { x: r.x, y: r.y + r.height },
  ];
}

export function pathContainsPoint(path: Path, x: number, y: number): boolean {
  if (path.kind === 'rect') {
    return x >= path.x && x <= path.x + path.width
        && y >= path.y && y <= path.y + path.height;
  }
  return pointInPolygon(path.points, x, y);
}

export function pathContainsRect(path: Path, rect: Rect): boolean {
  if (path.kind === 'rect') {
    return rect.x >= path.x
        && rect.y >= path.y
        && rect.x + rect.width  <= path.x + path.width
        && rect.y + rect.height <= path.y + path.height;
  }
  return polygonContainsRect(path.points, rect);
}

export function pathIntersectsRect(path: Path, rect: Rect): boolean {
  if (path.kind === 'rect') {
    return rect.x < path.x + path.width
        && rect.x + rect.width  > path.x
        && rect.y < path.y + path.height
        && rect.y + rect.height > path.y;
  }
  return polygonIntersectsRect(path.points, rect);
}

export function pathContainsPolygon(path: Path, polygon: readonly Point[]): boolean {
  if (path.kind === 'rect') {
    // Every polygon vertex must be inside the rect.
    return polygon.every((p) =>
      p.x >= path.x && p.x <= path.x + path.width
      && p.y >= path.y && p.y <= path.y + path.height
    );
  }
  return polygonContainsPolygon(path.points, polygon);
}

export function pathIntersectsPolygon(path: Path, polygon: readonly Point[]): boolean {
  if (path.kind === 'rect') {
    return polygonsIntersect(rectToPolygon(path), polygon);
  }
  return polygonsIntersect(path.points, polygon);
}
```

Notes:
- Phase 2's spec mentioned fill-rule as a parameter, but `Path` types as they stand don't carry a fill rule. The existing path renderer treats `PolygonPath` as non-zero by default. Keep these helpers fill-rule-agnostic (use the standard even-odd winding test for `pointInPolygon`) — if fill rule becomes a Path field later, extend then. Out-of-scope for Phase 2.
- The `polygonContainsPolygon` / `polygonsIntersect` helpers are local to this file. If they grow general use, refactor to `polygonHitTestRect.ts` (or rename it). Not in this task's scope.

- [ ] **Step 5: Run the tests**

```
npx vitest run src/features/paths/pathHitTest.test.ts
```

Expected: ALL PASS.

- [ ] **Step 6: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/features/paths/pathHitTest.ts src/features/paths/pathHitTest.test.ts
git commit -m "feat(paths): pathContainsPoint / pathContainsRect / pathIntersectsRect / pathContainsPolygon / pathIntersectsPolygon"
```

---

## Task 7: `walkClipAware` in `sceneAdapter`

**Files:**
- Modify: `src/canvas/sceneAdapter.ts`
- Modify: `src/canvas/sceneAdapter.test.ts`

Replace flat `hitTestArea` / `hitTestLasso` with a hierarchical walk that tests ancestor clips. Cache `clipFromPose(pose)` results per call to avoid recomputing during recursion.

- [ ] **Step 1: Read the current `hitTestArea` / `hitTestLasso`**

Read `src/canvas/sceneAdapter.ts` for the existing implementations. They likely iterate `scene.renderOrder()` flat.

- [ ] **Step 2: Write failing tests**

Add to `src/canvas/sceneAdapter.test.ts`:

```ts
it('hitTestArea respects ancestor clipFromPose', () => {
  const scene = createScene<{ label: string }, 'bg', Pose>({
    systemLayers: [{ id: 'bg' }],
  });
  const bed = scene.add({
    kind: 'container',
    layer: 'bg',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { label: 'bed' },
    // Clip is a smaller rect at the bed's center.
    clipFromPose: () => ({ kind: 'rect', x: 25, y: 25, width: 50, height: 50 }),
  } as never);
  scene.add({
    kind: 'leaf', layer: 'bg', parent: bed,
    // Leaf's AABB sits in the corner — inside the bed's pose AABB but outside its clip.
    pose: { x: 5, y: 5, width: 10, height: 10 },
    data: { label: 'corner' },
  });
  scene.add({
    kind: 'leaf', layer: 'bg', parent: bed,
    pose: { x: 40, y: 40, width: 10, height: 10 },
    data: { label: 'center' },
  });
  const adapter = sceneToAdapter(scene);
  // Marquee covering the entire bed area.
  const hits = adapter.hitTestArea!({ x: 0, y: 0, width: 100, height: 100 });
  const labels = hits.map((id) => scene.get(id as never)!.data.label);
  expect(labels).toContain('center');     // inside the clip
  expect(labels).not.toContain('corner'); // outside the clip
});

it('hitTestLasso respects ancestor clipFromPose', () => {
  const scene = createScene<{ label: string }, 'bg', Pose>({
    systemLayers: [{ id: 'bg' }],
  });
  const bed = scene.add({
    kind: 'container', layer: 'bg',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { label: 'bed' },
    clipFromPose: () => ({ kind: 'rect', x: 25, y: 25, width: 50, height: 50 }),
  } as never);
  scene.add({
    kind: 'leaf', layer: 'bg', parent: bed,
    pose: { x: 5, y: 5, width: 10, height: 10 },
    data: { label: 'corner' },
  });
  scene.add({
    kind: 'leaf', layer: 'bg', parent: bed,
    pose: { x: 40, y: 40, width: 10, height: 10 },
    data: { label: 'center' },
  });
  const adapter = sceneToAdapter(scene);
  // Lasso polygon covering the whole bed.
  const poly = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
  const hits = adapter.hitTestLasso!(poly, 'intersect');
  const labels = hits.map((id) => scene.get(id as never)!.data.label);
  expect(labels).toContain('center');
  expect(labels).not.toContain('corner');
});

it('clipFromPose is called once per query (cached during walk)', () => {
  const scene = createScene<{ label: string }, 'bg', Pose>({
    systemLayers: [{ id: 'bg' }],
  });
  let callCount = 0;
  const bed = scene.add({
    kind: 'container', layer: 'bg',
    pose: { x: 0, y: 0, width: 100, height: 100 },
    data: { label: 'bed' },
    clipFromPose: () => { callCount++; return { kind: 'rect', x: 25, y: 25, width: 50, height: 50 }; },
  } as never);
  // Many leaves so a naive impl would call clipFromPose per child.
  for (let i = 0; i < 5; i++) {
    scene.add({
      kind: 'leaf', layer: 'bg', parent: bed,
      pose: { x: i * 10, y: 30, width: 5, height: 5 },
      data: { label: `p${i}` },
    });
  }
  const adapter = sceneToAdapter(scene);
  callCount = 0;
  adapter.hitTestArea!({ x: 0, y: 0, width: 100, height: 100 });
  expect(callCount).toBe(1);  // called once for the bed, not 5 times
});
```

(Use the file's existing `Pose` / scene helpers. Adapt the imports if `createScene` / `sceneToAdapter` aren't already imported there.)

- [ ] **Step 3: Run to verify failure**

```
npx vitest run src/canvas/sceneAdapter.test.ts -t "clip"
```

Expected: FAIL on all three.

- [ ] **Step 4: Implement `walkClipAware`**

In `src/canvas/sceneAdapter.ts`, add a private helper used by both `hitTestArea` and `hitTestLasso`. The function takes a query (a discriminated union: `{ kind: 'rect', rect }` or `{ kind: 'lasso', polygon, mode }`) and a per-leaf test. It walks roots → children, calling `clipFromPose(pose)` once per container and propagating `ancestorClipsPass`.

```ts
import {
  pathIntersectsRect,
  pathContainsRect,
  pathIntersectsPolygon,
  pathContainsPolygon,
} from 'features/paths/pathHitTest';

type AreaQuery = { kind: 'area'; rect: Rect };
type LassoQuery = { kind: 'lasso'; polygon: readonly Point[]; mode: 'centers' | 'intersect' | 'enclosed' };
type Query = AreaQuery | LassoQuery;

function clipPassesForQuery(clip: Path, q: Query): boolean {
  if (q.kind === 'area') {
    // For an area marquee, we want "any part of the clip overlaps the query rect."
    // If the clip doesn't even intersect the marquee, no child inside that clip
    // can be selected.
    return pathIntersectsRect(clip, q.rect);
  }
  // Lasso: similar, mode-aware.
  if (q.mode === 'enclosed') return pathContainsPolygon(clip, q.polygon) || pathContainsPolygon(q.polygon as readonly Point[], polygonOf(clip));
  return pathIntersectsPolygon(clip, q.polygon);
}

function walkClipAware<Hit>(
  adapter: SceneAdapter,
  query: Query,
  leafTest: (id: string, pose: Pose) => Hit | null,
): string[] {
  const results: string[] = [];
  function walk(parentId: string | null, ancestorClipsPass: boolean) {
    for (const childId of adapter.getChildren(parentId)) {
      if (!ancestorClipsPass) continue;
      const node = adapter.getNode(childId);
      if (!node) continue;
      const pose = adapter.getPose(childId);
      // Test this node's own clip (cached: clipFromPose runs once here).
      let thisClipPasses = true;
      const maybeContainer = node as { kind?: string; clipFromPose?: (pose: Pose) => Path | null };
      if (maybeContainer.kind === 'container' && typeof maybeContainer.clipFromPose === 'function') {
        const path = maybeContainer.clipFromPose(pose);
        if (path) thisClipPasses = clipPassesForQuery(path, query);
      }
      // Run the leaf-test for this node if it passes its own clip.
      if (thisClipPasses) {
        const hit = leafTest(childId, pose);
        if (hit !== null && hit !== undefined) results.push(childId);
      }
      // Recurse into children — they're gated by ancestorClipsPass AND this clip.
      if (maybeContainer.kind === 'container') {
        walk(childId, ancestorClipsPass && thisClipPasses);
      }
    }
  }
  walk(null, true);
  return results;
}
```

`polygonOf(clip)` is a tiny helper that converts a `Path` to a point list (rect → 4 corners; polygon → its points). Add it inline or place it next to `clipPassesForQuery`.

Now replace `hitTestArea` and `hitTestLasso`:

```ts
hitTestArea(rect: Rect): string[] {
  return walkClipAware(this, { kind: 'area', rect }, (id, pose) => {
    // Existing AABB-vs-rect overlap test from the old flat impl
    const b = /* compute AABB from pose */;
    if (b.x < rect.x + rect.width
        && b.x + b.width > rect.x
        && b.y < rect.y + rect.height
        && b.y + b.height > rect.y) return id;
    return null;
  });
},
hitTestLasso(polygon: readonly Point[], mode: 'centers' | 'intersect' | 'enclosed'): string[] {
  return walkClipAware(this, { kind: 'lasso', polygon, mode }, (id, pose) => {
    // Existing leaf test from the old flat impl
    /* ...mode-aware AABB / center / containment test... */
    return /* matched ? id : null */;
  });
},
```

Read the existing flat implementations and lift the per-leaf test verbatim into the `leafTest` callback. The container clip check happens before the leaf test, not inside it.

- [ ] **Step 5: Run the new tests**

```
npx vitest run src/canvas/sceneAdapter.test.ts -t "clip"
```

Expected: PASS.

- [ ] **Step 6: Run the full adapter file**

```
npx vitest run src/canvas/sceneAdapter.test.ts
```

Expected: ALL PASS — the existing flat-hit-test tests still match because trees without `clipFromPose` skip the clip check (`ancestorClipsPass` stays true).

- [ ] **Step 7: Run the full kit suite**

```
npx vitest run
```

Expected: 1 pre-existing unrelated failure, everything else green.

- [ ] **Step 8: Typecheck**

```
npx tsc --noEmit
```

Expected: clean.

- [ ] **Step 9: Commit**

```bash
git add src/canvas/sceneAdapter.ts src/canvas/sceneAdapter.test.ts
git commit -m "feat(canvas): walkClipAware — hitTestArea and hitTestLasso honor ancestor clips"
```

---

## Task 8: Clip-aware default `pickEvery` in `useSelectTool`

**Files:**
- Modify: `src/tools/builtin/useSelectTool.ts`
- Modify: `src/tools/builtin/useSelectTool.test.tsx` (or wherever the default fallback is tested)

The default `pickEvery` fallback flat-scans `adapter.getNodes()` for AABB-vs-point hits today. Switch it to a clip-aware walk (analogous to `walkClipAware` but for point queries). Consumer-supplied `pickEvery` overrides are NOT auto-wrapped.

- [ ] **Step 1: Locate the default `pickEvery`**

Read `src/tools/builtin/useSelectTool.ts` and find where `options.pickEvery` is used. The fallback is something like `options.pickEvery ?? defaultPickEvery(adapter, options.poseBounds)`. If it's inlined, find the inline version.

- [ ] **Step 2: Write a failing test**

Add to the existing test file for `useSelectTool` (or create one if missing — look at `useSelectTool.bringToFront.test.tsx` for the test-pattern reference):

```ts
it('default pickEvery respects ancestor clipFromPose', () => {
  // Set up a scene with a clipped container and a leaf in the clip's "shadow"
  // (AABB-inside the container but outside its clip). Click on the shadow:
  // the leaf should NOT be picked.
  // ... harness similar to bringToFront test ...
  // Click on the leaf's AABB but outside the container's clip.
  // Confirm selection stays empty.
});
```

(Full code mirrors the sceneAdapter test from Task 7 but exercises the tool's pointer flow. Reuse the test harness from `useSelectTool.bringToFront.test.tsx`.)

- [ ] **Step 3: Run to verify failure**

```
npx vitest run src/tools/builtin/useSelectTool -t "clipFromPose"
```

Expected: FAIL — default pickEvery is still flat.

- [ ] **Step 4: Implement clip-aware default `pickEvery`**

In `src/tools/builtin/useSelectTool.ts`, replace the flat-scan default with a walkClipAware-equivalent for points. Reuse `pathContainsPoint` from `features/paths/pathHitTest`.

The implementation: walk the scene tree (via `adapter.getChildren(null)` etc.), test point against `clipFromPose(pose)` at each container, propagate `ancestorClipsPass`, and at each leaf check AABB-vs-point. Return all matching ids.

If `adapter.getChildren` isn't present on the adapter (hand-rolled non-scene adapter), fall back to today's flat scan.

```ts
const defaultPickEvery = (worldX: number, worldY: number): string[] => {
  const a = adapter as {
    getNode?: (id: string) => unknown;
    getChildren?: (parentId: string | null) => readonly string[];
    getPose?: (id: string) => TPose;
  };
  if (typeof a.getChildren !== 'function' || typeof a.getNode !== 'function') {
    // Flat fallback (today's behavior).
    const results: string[] = [];
    for (const obj of adapter.getNodes()) {
      const pose = adapter.getPose(obj.id);
      const b = poseBoundsFn(pose);
      if (worldX >= b.x && worldX <= b.x + b.width
          && worldY >= b.y && worldY <= b.y + b.height) {
        results.push(obj.id);
      }
    }
    return results;
  }
  // Clip-aware walk.
  const results: string[] = [];
  function walk(parentId: string | null, ancestorClipsPass: boolean) {
    for (const childId of a.getChildren!(parentId)) {
      if (!ancestorClipsPass) continue;
      const node = a.getNode!(childId) as { kind?: string; clipFromPose?: (pose: TPose) => Path | null };
      const pose = a.getPose!(childId);
      let thisClipPasses = true;
      if (node.kind === 'container' && typeof node.clipFromPose === 'function') {
        const path = node.clipFromPose(pose);
        if (path) thisClipPasses = pathContainsPoint(path, worldX, worldY);
      }
      if (thisClipPasses) {
        const b = poseBoundsFn(pose);
        if (worldX >= b.x && worldX <= b.x + b.width
            && worldY >= b.y && worldY <= b.y + b.height) {
          results.push(childId);
        }
      }
      if (node.kind === 'container') {
        walk(childId, ancestorClipsPass && thisClipPasses);
      }
    }
  }
  walk(null, true);
  return results;
};
```

(Place the function where the existing default fallback is. Match the existing variable names — `poseBoundsFn`, etc. — from the surrounding code.)

- [ ] **Step 5: Run the new test**

```
npx vitest run src/tools/builtin/useSelectTool -t "clipFromPose"
```

Expected: PASS.

- [ ] **Step 6: Run all useSelectTool tests**

```
npx vitest run src/tools/builtin/useSelectTool
```

Expected: ALL PASS — non-clipped scenes are unaffected.

- [ ] **Step 7: Run the full kit suite**

```
npx vitest run
```

Expected: same baseline.

- [ ] **Step 8: Commit**

```bash
git add src/tools/builtin/useSelectTool.ts src/tools/builtin/useSelectTool.test.tsx
git commit -m "feat(tools): useSelectTool default pickEvery honors ancestor clipFromPose"
```

---

## Task 9: ClippingDemo

**Files:**
- Create: `demo/demos/ClippingDemo.tsx`
- Modify: `demo/registry.ts`

Canonical visual reference: a container with an elliptical clip, two overhanging children. Used as a regression baseline and consumer-facing example.

- [ ] **Step 1: Read existing demos for the pattern**

Read `demo/demos/SceneDemo.tsx` and `demo/demos/ResizeDemo.tsx` for the `useScene` + `SceneCanvas` pattern. Note how `drawOne` is wired and how containers/leaves are constructed.

- [ ] **Step 2: Build the demo**

Create `demo/demos/ClippingDemo.tsx`:

```tsx
import { asNodeId, SceneCanvas, useScene } from '@weasel-js/core';
import type { DrawCommand } from '../../src/renderer';
import type { Path } from '../../src/features/paths/types';

interface Item { id: string; label: string; color: string; }
type Pose = { x: number; y: number; width: number; height: number; };

const W = 400, H = 300;

function ellipsePath(pose: Pose, segments = 48): Path {
  const points: { x: number; y: number }[] = [];
  const cx = pose.x + pose.width / 2;
  const cy = pose.y + pose.height / 2;
  const rx = pose.width / 2;
  const ry = pose.height / 2;
  for (let i = 0; i < segments; i++) {
    const t = (i / segments) * Math.PI * 2;
    points.push({ x: cx + rx * Math.cos(t), y: cy + ry * Math.sin(t) });
  }
  return { kind: 'polygon', points };
}

export function ClippingDemo() {
  const scene = useScene<Item, 'default', Pose>({
    systemLayers: [{ id: 'default' }],
    items: [
      {
        id: 'bed' as never,
        kind: 'container',
        layer: 'default',
        pose: { x: 80, y: 50, width: 240, height: 200 },
        data: { id: 'bed', label: 'bed', color: '#5a4a3a' },
        clipFromPose: (pose: Pose) => ellipsePath(pose),
      },
      {
        id: 'p1' as never,
        parent: 'bed' as never,
        kind: 'leaf',
        layer: 'default',
        pose: { x: 40, y: 100, width: 120, height: 80 },
        data: { id: 'p1', label: 'p1', color: '#7fb069' },
      },
      {
        id: 'p2' as never,
        parent: 'bed' as never,
        kind: 'leaf',
        layer: 'default',
        pose: { x: 240, y: 120, width: 140, height: 100 },
        data: { id: 'p2', label: 'p2', color: '#d4a574' },
      },
    ],
  });

  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      layers={{
        scene: {
          drawOne: (_node, p, _view): DrawCommand[] => {
            const data = _node.data as Item;
            return [{
              kind: 'path',
              path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
              fill: { color: data.color },
            }];
          },
        },
      }}
    />
  );
}
```

(Adapt the type signatures to match the rest of the codebase's demo style — the `as never` casts above may differ from the canonical pattern. Look at `SceneDemo.tsx` for guidance.)

- [ ] **Step 3: Register the demo**

In `demo/registry.ts`, add an entry for ClippingDemo following the existing pattern. The id slug should be `clipping` (so the URL is `#clipping`). Look at other entries' shape.

- [ ] **Step 4: Smoke-test in a browser**

Start the dev server:

```
npm run dev
```

Open the new demo. Visually confirm:
- The bed (brown background rect) is fully painted.
- The two children (green / orange rects) are visible only within the elliptical clip region — overhanging parts are clipped away.
- No console errors.

If the demo doesn't render, check the dev console for errors and trace back to the renderer (Task 5 integration) or buildSceneTree (Task 2).

- [ ] **Step 5: Run full test suite + build**

```
npx vitest run && npx tsc --noEmit && npm run build
```

Expected: all clean (1 pre-existing unrelated failure).

- [ ] **Step 6: Commit**

```bash
git add demo/demos/ClippingDemo.tsx demo/registry.ts
git commit -m "demo(clipping): elliptical container clip with overhanging children"
```

---

## After all tasks

Run the full pipeline one more time:

```
npx tsc --noEmit && npx vitest run && npm run build
```

Browser smoke test (manual):
- `ClippingDemo` shows the elliptical clip working.
- `LayoutDemo`, `SceneDemo`, `MultiSelectDemo`, `LassoDemo`, `ResizeDemo` look identical to before Phase 2 (no clip declared, no behavior change).

If the visual-regression rig is wired up, run baselines against the unchanged demos to confirm no pixel drift, and capture a new baseline for ClippingDemo.

Phase 2 done. Garden can now declare `clipFromPose` on container nodes; descendants clip; hit-tests respect the clips.
