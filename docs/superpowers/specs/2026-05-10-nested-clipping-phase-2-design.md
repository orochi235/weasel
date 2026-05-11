# Nested Clipping (Phase 2 of nested clipping)

**Status:** design approved 2026-05-10. Phase 2 of a two-phase rollout. Phase 1 (hierarchical scene rendering, spec at `docs/superpowers/specs/2026-05-10-hierarchical-scene-rendering-design.md`) ships first and is a prerequisite — Phase 2 attaches `clip: Path` to the wrapper groups Phase 1 emits.

**Goal:** Add nested clipping to the kit. Container nodes can declare a clip path via `clipFromPose?: (pose) => Path | null`; the renderer rasterizes the clip into the stencil buffer; descendants paint only where the intersection of all ancestor clips covers; the hit-test pipeline mirrors the same intersection logic so users can't pick what they can't see.

**Non-goals:**
- Alpha-masking (any rendered output as a mask) — strictly more powerful than path clipping; not on the garden roadmap. Phase 2's stencil-bit-partitioning approach doesn't preclude a future FBO-based mask, but they aren't built together.
- Filter effects (blur, shadows applied to subtrees).
- Transform stacks on groups (still out of scope; weasel's flat-pose model is unchanged).
- Clip nesting deeper than 7 levels — explicit throw at depth 8.

## Motivation

Garden needs nested clipping: regions clip beds, beds clip plantings. The renderer-side path Eric proposed (`clip?: Path` on `GroupDrawCommand`) is the right shape, and weasel's existing WebGL stencil infrastructure (used today for evenodd fills and inner/outer strokes) extends naturally to it. Phase 1 set up hierarchical scene rendering so the kit emits per-container wrapper groups; Phase 2 attaches clip paths to those wrappers and teaches the renderer + pickers to honor them.

## Decisions locked in

- **`clipFromPose?: (pose: TPose) => Path | null` on `ContainerNode`.** Derived, not static — re-evaluated each render. Returning `null` means "no clip for this container right now."
- **Intersection semantics.** Nested clips intersect; a child can never escape an ancestor's clip. Standard SVG/Figma/Canvas2D behavior.
- **Stencil bit-partitioning.** High 3 bits of the 8-bit stencil hold the clip depth (0–7); low 5 bits remain owned by the existing path-stencil code (evenodd, stroke alignment). 7 nested clips max; throw on attempt to push deeper.
- **Clip path is in world-space.** Same as the kit's poses. No group transform stack to compose against.
- **Fill rule inherited from the path.** A clip path's `fillRule` field determines coverage exactly the same way it does for a fill — `nonzero` (default) or `evenodd`. No separate `clipFillRule`.
- **Strokes respect clipping.** A stroke draw under an active clip stack runs through the same `stencilFunc` test as fills; ribbons clip cleanly.
- **Clip-aware hit-testing.** `pickEvery`, `hitTestArea`, `hitTestLasso` all walk hierarchically and intersect the query against ancestor clip paths. You can't click what the clip hides.
- **Chrome is never clipped by the kit.** Tools' overlay layers (selection handles, rotation handles, etc.) live in screen space and ignore scene clips. A tool that wants clip-aware chrome can walk the adapter ancestor chain itself; the kit doesn't force it.
- **Empty clip = draw nothing.** A path with zero coverage (degenerate rect, etc.) results in 0 stencil fragments; children paint nowhere. Returning `null` from `clipFromPose` ≠ returning an empty path; null skips clipping, empty path clips everything out.
- **Depth-exceeded behavior: throw, don't degrade.** Loud failure, specific message — silent degradation would hide bugs.

## Architecture

### Scene type addition: `src/core/scene/types.ts`

```ts
export interface ContainerNode<TData, TLayer extends string, TPose = RectPose>
  extends NodeBase<TData, TLayer, TPose> {
  kind: 'container';
  children: NodeId[];
  clipFromPose?: (pose: TPose) => Path | null;   // NEW
}
```

Scene mutation paths construct container nodes via `kit:add`; the op already takes the spec verbatim. `clipFromPose` is a function (not data), so it's a Node-level optional field separate from the `data` payload. Scene serialization/snapshotting (if/when added) would need to handle it specially — out of Phase 2 scope, since the kit doesn't serialize today.

### DrawCommand addition: `src/renderer/DrawCommand.ts`

```ts
export interface GroupDrawCommand {
  kind: 'group';
  transform?: Mat3;
  alpha?: number;
  colorMatrix?: number[];
  clip?: Path;       // NEW
  children: DrawCommand[];
}
```

Additive. Existing consumers that emit `kind: 'group'` without `clip` get the same behavior as today.

### `buildSceneTree.ts` extension

`buildNodeGroup` checks for `clipFromPose` on container nodes and attaches the result:

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
  if (node.kind === 'container' && typeof node.clipFromPose === 'function') {
    const clip = node.clipFromPose(pose);
    if (clip) group.clip = clip;
  }
  return group;
}
```

`buildSceneTree`'s function signature gains a tighter constraint on `TNode` (it must permit `kind` and `clipFromPose` checks). The interface stays generic — non-container nodes simply skip the clip attachment.

### Renderer changes: `src/renderer/draw.ts`

**DrawContext state stack** gains a `clipDepth: number` field initialized to 0. `drawGroup` reads it for `stencilFunc` ref and increments/decrements on push/pop.

**Stencil bit layout:**
- High 3 bits (`0xE0`): clip depth, 0–7.
- Low 5 bits (`0x1F`): owned by existing path-stencil code.

**Audit of existing stencil call sites:**
- `drawPathFillStencil`:
  - `gl.stencilMask(0xFF)` → `gl.stencilMask(0x1F)` (both pass writes).
  - `gl.stencilFunc(gl.NOTEQUAL, 0, 0xFF)` → `gl.stencilFunc(gl.NOTEQUAL, 0, 0x1F)`.
  - Before `gl.clear(STENCIL_BUFFER_BIT)`: explicitly set `gl.stencilMask(0x1F)` so the clear only wipes the low bits.
- `drawPathStrokeStenciled`: same narrowing pattern.

**New helpers in `draw.ts`:**

`pushClip(ctx, path, newDepth)`:
```ts
gl.enable(STENCIL_TEST);
gl.colorMask(false, false, false, false);   // stencil-only pass
gl.stencilMask(0xE0);                       // write only high 3 bits
gl.stencilFunc(EQUAL, currentDepth << 5, 0xE0); // only inside current clip
gl.stencilOp(KEEP, KEEP, REPLACE);
// Rasterize clip path via existing tessellation + drawElements with ref = newDepth << 5.
// REPLACE writes (ref & stencilMask) | (old & ~stencilMask).
// Where stencilFunc fails (outside ancestors' clip), no write. Intersection automatic.
gl.colorMask(true, true, true, true);
```

`popClip(ctx, path, oldDepth)`: same as push, but with `ref = oldDepth << 5`, redrawing the popped clip's geometry to restore the prior depth value.

`drawGroup` becomes clip-aware:
```ts
function drawGroup(ctx, cmd) {
  ctx.state.push({ transform, alpha, colorMatrix });
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

**Child draw call sites** — every code path that draws a fragment (paths, strokes, text, images, shaders) prepends a `stencilFunc(EQUAL, ctx.state.clipDepth << 5, 0xE0)` when `clipDepth > 0`. Implemented as a single helper called from each draw function. When `clipDepth === 0`, the helper disables `STENCIL_TEST` (no overhead for non-clipped trees, which is the common case).

### Hit-test integration: `src/canvas/sceneAdapter.ts` + `src/features/paths/`

New path helpers in `src/features/paths/`:
- `pathContainsPoint(path, x, y, fillRule)`
- `pathContainsRect(path, rect, fillRule)`
- `pathIntersectsRect(path, rect, fillRule)`
- `pathContainsPolygon(path, polygon, fillRule)`
- `pathIntersectsPolygon(path, polygon, fillRule)`

Reuse the existing `polygonContainsRect` family for polygon-shaped paths. Add new code for bezier/general paths: winding-number point test, sampled subdivision for area/polygon containment. Fill rule is inherited from the path; helpers accept it as a parameter.

**Hit-test rewrite** in `sceneToAdapter`. Three entry points get the clip-aware walk: `hitTestArea`, `hitTestLasso`, and the kit's default `pickEvery` fallback in `useSelectTool` (which today flat-scans `adapter.getNodes()` for AABB-vs-point hits). Consumer-supplied `pickEvery` overrides are responsible for their own clip-awareness — `useSelectTool` doesn't auto-wrap them, since some consumers (path-aware hit tests, custom picking strategies) need full control.

```ts
hitTestArea(rect):
  return walkClipAware(rect, areaMatchesAABB)

hitTestLasso(polygon, mode):
  return walkClipAware({ polygon, mode }, lassoMatches)

// Default pickEvery fallback inside useSelectTool — switches from
// flat AABB scan to walkClipAware.
defaultPickEvery(x, y):
  return walkClipAware({ x, y }, pointInAABB)

walkClipAware(query, leafTest):
  results = []
  walk(parentId = null, ancestorClipsPass = true):
    for childId in scene.getChildren(parentId):
      if not ancestorClipsPass: continue
      node = scene.getNode(childId)
      thisClipPasses = true
      if node.kind === 'container' && node.clipFromPose:
        path = node.clipFromPose(node.pose)
        if path: thisClipPasses = pathTestForQuery(path, query)
      if thisClipPasses && leafTest(node, query):
        results.push(childId)
      if node.kind === 'container':
        walk(childId, ancestorClipsPass && thisClipPasses)
  return results
```

The clip test result for each ancestor is **cached per gesture event** if the pose hasn't changed — a single pointermove typically queries multiple times during the same frame.

### Demo addition: `demo/demos/ClippingDemo.tsx`

New demo: a container with an ellipse-shaped `clipFromPose`, two leaf children that overhang the ellipse. Visual regression baseline captures the clipped output. Used as the canonical reference for kit users learning the feature.

## Data flow

```
ContainerNode { clipFromPose: (pose) => Path | null }
              │
              ▼
   buildSceneTree (Phase 1 module, extended)
              │
              ▼
   GroupDrawCommand { clip: Path, children: [...] }
              │
              ▼
   WeaselRenderer.drawGroup (extended)
              │
              ├─ pushClip(path, newDepth)  ← stencil-only pass, writes (depth+1) into high 3 bits
              ├─ dispatch each child       ← each child's fragment test reads ctx.state.clipDepth
              └─ popClip(path, oldDepth)   ← restores prior depth
```

Hit-test pipeline:
```
pickEvery(x, y) / hitTestArea(rect) / hitTestLasso(polygon, mode)
              │
              ▼
   walkClipAware (new in sceneAdapter)
              │
              ├─ at each container: pathTestForQuery(clipFromPose(pose), query)
              ├─ propagate `ancestorClipsPass` down the recursion
              └─ leaves only added if leafTest passes AND ancestorClipsPass
```

## Components

| Component | Responsibility | Dependencies |
|-----------|---------------|--------------|
| `ContainerNode.clipFromPose` | Declarative clip-path source on container nodes | None — pure type addition |
| `GroupDrawCommand.clip` | Per-group clip path in DrawCommand | `Path` type |
| `buildSceneTree` (extended) | Read `clipFromPose` from adapter nodes, attach to wrapper groups | Existing module from Phase 1 |
| Stencil bit-partitioning audit | Existing path-stencil code uses only low 5 bits | `src/renderer/draw.ts` |
| `pushClip` / `popClip` helpers | Stencil-only passes that increment/decrement clip depth | Existing stencil infrastructure, GL state |
| `drawGroup` extension | Detect `cmd.clip`, push/pop around children, depth limit | `pushClip`, `popClip`, `DrawContext.state.clipDepth` |
| Per-fragment clip test | Each draw call's leading `stencilFunc` call when `clipDepth > 0` | `DrawContext.state.clipDepth` |
| `pathContains*` / `pathIntersects*` helpers | Point / rect / polygon vs path tests, fill-rule-aware | `src/features/paths/` existing helpers |
| `walkClipAware` in sceneAdapter | Hierarchical hit-test that respects ancestor clips | Path-test helpers, scene traversal |
| `ClippingDemo` | Canonical visual reference + regression target | New demo file |

## Impact on existing code

- **All existing demos** — none declare `clipFromPose` on their containers, so behavior is unchanged. No visual regressions.
- **WebGL stencil-using paths (evenodd, inner/outer stroke)** — narrowed bit masks. Tests confirm low-bit clears don't bleed into high bits and vice versa.
- **Hit-test entry points** (`pickEvery`, `hitTestArea`, `hitTestLasso`) — switch from flat `scene.renderOrder()` to hierarchical walks. For scenes without clipped ancestors, results are identical (every node passes the trivial `ancestorClipsPass = true`).
- **Selection chrome / tool overlays** — unaffected. Chrome doesn't honor clips by default; tools can opt in by walking the adapter ancestor chain.
- **`drawGroup` callers** — additive; existing `GroupDrawCommand` without `clip` are unchanged.

## Testing

### Renderer (`src/renderer/draw.test.ts`)

- **Bit-partitioning audit:** simulate stencil state with high bits set (clip depth = 1), run `drawPathFillStencil`, confirm high bits unchanged. Same for `drawPathStrokeStenciled`.
- **Clip push/pop sequence:** assert the GL call recorder receives the expected `stencilFunc` / `stencilOp` / `stencilMask` / `colorMask` calls for a single clip push and pop.
- **Depth-limit throw:** simulate 7 nested clip pushes; the 8th throws with the specific error message.
- **Nested clip integration:** build a `GroupDrawCommand` tree with 2 levels of clipping; verify the recorded GL sequence matches expected stencil ordering.

### `buildSceneTree.test.ts` (extension)

- Container with `clipFromPose` returning a non-null path → emitted group's `clip` field equals the returned path.
- Container with `clipFromPose` returning `null` → emitted group has no `clip` field.
- Container without `clipFromPose` → no `clip` field.
- `clipFromPose` is called with the current pose (live read, not stale).

### Hit-test (`src/canvas/sceneAdapter.test.ts` + new `clipHitTest.test.ts`)

- `pickEvery` over a clipped container, point inside leaf's AABB but outside parent's clip → leaf NOT in results.
- Same point inside parent's clip → leaf IS in results.
- Two-level nesting: leaf inside bed inside region. Point in leaf's AABB but outside region → not returned. Inside region but outside bed → not returned. Inside all clips → returned.
- `hitTestArea` with rect partially inside a clip: returns ids whose AABB intersects the rect AND ancestor clips don't fully exclude them.
- `hitTestLasso` with `centers`, `intersect`, `enclosed` modes against clipped subtree — symmetrical coverage.
- Clip caching: assert `clipFromPose` is called once per query, not per child traversal.

### Integration (`src/canvas/Canvas.test.tsx`)

- Scene with one container with `clipFromPose` produces a draw output where the inner group has `clip` set.
- Marquee gesture inside a clipped container's chrome area selects only ids inside the clip.
- Visual snapshot: ClippingDemo's baseline.

### Path helpers (`src/features/paths/pathContainsPoint.test.ts`, etc.)

- Each new helper gets its own test file with cases for rect/circle/polygon/bezier path kinds, both fill rules where applicable.

### Not in Phase 2's test scope

- Performance benchmarks (clip cost is bounded by depth × fragments; max depth is 7, demo scenes are shallow).
- FBO/alpha-mask path (not in this phase).

## Release notes (one-liner)

> Container nodes can declare a clip path via `clipFromPose?: (pose) => Path | null`. The renderer rasterizes the clip into the stencil buffer (high 3 bits reserved for clip depth, max 7 nested levels); descendants paint only where all ancestor clips intersect. Hit-test pipeline mirrors the same intersection logic — a point/rect/lasso query that falls outside an ancestor's clip excludes the descendant from results. Path-stencil code (evenodd fills, inner/outer strokes) was audited to use only the low 5 stencil bits and doesn't conflict with clip state.
