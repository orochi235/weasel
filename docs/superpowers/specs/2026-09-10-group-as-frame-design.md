# A group is a frame

**Status: designed, not built.** Nothing in this document is in the tree yet.

**What this is:** the design for making a container's pose mean something to
its children. Today nesting contributes a clip chain and nothing else, so a
rotated container leaves its contents upright.

**Who it's for:** whoever implements it. Assumes `Scene<TData, TLayer, TPose>`,
the render walks (`buildSceneTree` for `SceneCanvas`, `buildSceneViewCommands`
for the detached surfaces), and `PoseComposition` in
`features/groups/composePose.ts`.

**What it answers:** which of the two readings of `getPose` the kit commits to,
what composition can express, where world coordinates get resolved, and why
this needs no change to the renderer.

---

## The state today

`getPose(id)` is documented as **local** — relative to the parent
(`core/adapters/types.ts:33-37`, `composePose.ts:4-8`). Every render walk hands
it straight to the painter as though it were world (`buildSceneTree.ts:75-79`,
`sceneViewRender.ts:113`). `derivedPath.ts:21-24` states the contradiction in
the tree: *"`Scene` stores absolute poses and the render walks hand `getPose`
straight to `drawOne`, composing nothing."*

Of roughly sixty pose consumers, one composes correctly: `move.ts`.
`useNodeOverlayFrame` composes but reads the authored pose, so it misses gesture
overrides. `nestedHit` composes and has no caller inside the kit. Everything
else — both pick sources, all selection chrome, align/distribute/flip, the
diagram edge router, SVG export, clipboard, the minimap — reads a local pose and
treats it as world.

**No dep source anywhere registers `poseComposition`.** Not in `canvas/deps/`,
not in either app. So `move` and `duplicate` always run on
`IDENTITY_POSE_COMPOSITION`, where local and world are equal by construction and
every one of those sites is accidentally right.

That is why this is a contract to choose, not a bug to repair. The cost of
leaving it unchosen is that the two readings stay live at once, and any consumer
who supplies a real composition gets children painted at their local offsets on
every surface.

## The decision

**A container's pose defines a frame.** A child's pose is expressed in that
frame; composing up the parent chain yields world. Rotating a container rotates
its contents. Reparenting rebases so the child does not visually move.

The alternative — poses stay absolute, a container is grouping-only,
`PoseComposition` becomes interaction-only and leaves the render story — is
cheaper and was rejected. It permanently forecloses a rig being expressed as
parenting, which is what the tree already is everywhere except the scene.

## What a pose can carry

`RectPose` is `{x, y, width, height, rotation?}`, with rotation about the
**unrotated** AABB center (`core/scene/types.ts:13-20`). Composition is
therefore bounded by what that shape can hold. Measured over 50,000 random
parent/child pairs:

| parent transform            | exact as a pose | worst error |
|-----------------------------|-----------------|-------------|
| rotate + translate          | yes             |    5.7e-13  |
| + uniform scale             | yes             |    5.7e-13  |
| + anisotropic scale         | no              |    9.9e-01  |

The first two are float noise. The third is `|cos|` between adjacent edges of
the child's transformed box: an anisotropic parent turns a rotated child into a
parallelogram, and no `{x, y, width, height, rotation}` can hold one.

**So anisotropic parent scale is out of the pose model.** This is not a new
concession: `remapRotatedLeaf` already maps the local axes under a group affine,
drops the shear, and recomputes `rotation = atan2(uy, ux)`, and its docstring
says why.

`RectPose` carries no scale factor of its own — `width`/`height` are the size,
not a multiplier — so the strategy this ships is **rigid**: translate and
rotate. The uniform-scale row of the table is what a consumer whose `TPose` does
carry a scale can rely on; it is not something the shipped strategy exercises.

A `PoseComposition` declares its own closure so the limit is legible rather than
discovered:

```ts
type PoseClosure = 'identity' | 'translation' | 'rigid';

interface PoseComposition<TPose> {
  compose: (parent: TPose, child: TPose) => TPose;
  decompose: (parent: TPose, world: TPose) => TPose;
  /** The transforms `compose` represents exactly. Anything wider is rounded
   *  to the nearest pose, which for 'rigid' means shear is dropped. */
  closure: PoseClosure;
}
```

`RECT_POSE_COMPOSITION` (`'translation'`, the existing behavior) and
`RIGID_POSE_COMPOSITION` (`'rigid'`) both ship; `composeRigidPose` reduces to
`composeRectPose` when the parent is upright, so a scene that never rotates a
container behaves identically under either.

## The pose is the source of truth, not a matrix

The obvious alternative design accumulates a `Mat3` down the tree and hangs it
on the `GroupDrawCommand.transform` the renderer already supports. It is
rejected as the *scene's* model, for one reason: it produces two answers to
"where is this node" — a matrix for the renderer and a pose for the sixty
consumers that speak poses — and nothing keeps them equal.

The pose alone is sufficient, because of how the render walk is already wired.
`filteredDrawOne` hands the **same** pose to both the painter and the per-node
wrap (`Canvas.tsx:625-631`), and `wrapNodeOutput` rotates the painter's output
about that pose's center by that pose's rotation (`wrapNodeOutput.ts:18-27`).
Feed a composed world pose in and the painter draws in the composed box while
the wrap applies the composed rotation. Both are then correct.

**The renderer needs no change.** `GroupDrawCommand.transform` stays what it is
— the view transform and the per-node rotation wrap. It is not promoted to a
scene concept, and the batch is untouched.

Clips fall out for free. `buildSceneTree` builds a container's clip from the
pose it is holding and requires the result to be world-space (`:44-49`); once
that pose is composed, `clipFromPose(pose)` and `findShapeSilhouette(node, pose)`
both produce world silhouettes, closing the contradiction that walk documents
today.

## The seam

**`getPose` keeps meaning local.** Redefining it to return world would make
every existing consumer silently change meaning, and under the identity default
no test would notice — the failure this repo files under "an API that exists but
has no consequence".

Instead the adapter gains `getWorldPose(id)`, resolved through the scene's
`PoseComposition`, and consumers migrate to it deliberately. Three funnels carry
most of the sixty sites:

1. `canvas/sceneAdapter.ts:257-262` — feeds `Canvas.tsx:603`,
   `useViewHelpers.ts:190,203`, `useSceneSelectTool.ts:230,270`,
   `SceneCanvas.tsx:1257`.
2. `canvas/sceneViewRender.ts:113` — both headless renders.
3. `core/scene/effectivePose.ts:109` (`derivedDepOf`) — every derived path and
   pose, the diagram edge router, and both pick sources.

`getWorldPose` serves the consumers that ask about one node at a time —
chrome, picking, actions, export — and walks the parent chain to answer.

The render walks do not use it. They visit every node already, so they
accumulate the composed pose down the tree instead: `buildSceneTree` threads an
accumulator for clips today and the composed pose rides beside it, which is O(1)
per node where `composeWorldPose` would be O(depth). The two must agree, and the
composition law below is what holds them together.

Writers are unaffected. Ops and `setPose` continue to write local poses;
`rebaseLocalPose` already exists for the reparent case and `move.ts` already
uses it.

## Migration order

Each step is separately shippable and each is a no-op under the identity
default.

1. `closure` on `PoseComposition`; `composeSimilarityPose` / `decomposeSimilarityPose`
   beside the existing rect pair. Nothing consumes them yet.
2. `getWorldPose` on the scene adapter; the accumulator in both render walks.
3. Pick and hit-testing — both pick sources, `hitTestArea`, `getNodeAtPoint`.
4. Selection chrome — `useViewHelpers`, `chromeState`, `overlay.ts`'s
   `makeContainerAwareBoundsResolver`, which walks the tree today and composes
   nothing.
5. Actions — `resize`, `rotate`, `group`, `clone`, `flip`, align, distribute.
6. Export and clipboard — `svgExport`, `snapshotSelection` / `commitPaste`.

## Testing: the identity trap

**Under `IDENTITY_POSE_COMPOSITION` every bug in this area is invisible**,
because local and world are the same value. A test written against the default
scene passes before the fix and after it, and asserts nothing.

So the arc needs one shared fixture — a scene with a rotated, uniformly scaled
container holding two children at non-zero local offsets, one of them rotated —
and every migrated consumer is exercised against it. Where a consumer's output
is geometric, assert corners rather than a bounding box: an AABB of a rotated
child is equal for several wrong answers.

Two further checks earn their place:

- **The composition law.** For each shipped strategy, `compose` then `decompose`
  round-trips, and `compose` agrees with mapping the child's corners through the
  parent's frame. This is what pins `closure: 'rigid'` as a true claim
  rather than a label.
- **The two resolvers agree.** The walk's accumulator and `getWorldPose` must
  return the same pose for every node of the fixture. They are separate code
  paths answering one question, which is the shape of bug this design is meant
  to avoid rather than introduce.
- **Pixels, not just poses.** `tests/visual/` gets a rotated-container case. A
  composed pose that is right in the walk and wrong in the wrap produces correct
  numbers and a visibly wrong picture.

## What this does not fix

Stated so nobody plans against it:

- **Anisotropic parent scale.** Out of the pose model, by the table above. A
  consumer needing it wants a matrix-shaped `TPose` and its own composition,
  which this design permits and does not supply.
- **A rig with non-uniform bone scale.** `JointTransform` carries `scaleX` and
  `scaleY` separately (`animation/rig/types.ts:8`), so a bone chain using them
  stays flattened onto independent nodes. A rigid or uniformly scaled rig
  becomes expressible as parenting, which is what TODO 914 asks for.
- **`kitRegistry.ts:32`'s `unionOfChildren`.** A container whose pose is derived
  from its children's poses, which are expressed in the container's frame, is
  circular. It works today only because the frame is identity. It needs its own
  decision and is not in this arc.
- **`nestedHit`**, which composes correctly and has no caller. Either it gets
  one or it goes; not decided here.
