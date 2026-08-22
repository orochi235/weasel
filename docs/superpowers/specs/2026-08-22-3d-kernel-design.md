# Introducing 3D to weasel

Direction doc for a weasel maintainer deciding how 3D would enter the project.
It answers one question: **where does the boundary go?** — and phases the work
behind it. It is not an implementation plan; no phase past 0 is scheduled.

The constraint that shapes every choice below: **2D DX must not get worse.**
That rules out the two obvious options and picks a third.

## The two rejected options

**Expand `@weasel-js/core` to N dimensions.** `View` grows a projection,
`DrawCommand` grows a `z`, `Scene` grows a depth-sorted traversal — and every
existing 2D call site starts carrying a dimension parameter or writing
`z: 0`. The generalized API is worse for both cases than two honest ones.

**A parallel 3D kernel "swappable" with core.** Swappability implies a shared
interface at kernel level, which forces that same union of 2D and 3D concepts.
The sharing worth having already exists one level lower.

## Where the boundary actually is

`@weasel-js/gestures` and `@weasel-js/history` have **zero dependencies**, and
the gesture grammar is about input, not geometry: wheel direction, key names,
finger counts, modifiers, `channel:phase` tool routing. The only spatial thing
in its public surface is `centroid?: {x, y}` on `inputEvent` — a screen-space
pointer position, equally correct over a 3D scene. Pointers are 2D in any
kernel.

So a 3D kernel is a **sibling** that depends on `gestures` + `history` and
brings its own renderer, camera, and picking. Core takes no diff, which is the
only way to guarantee 2D DX cannot regress.

What does not transfer, and is not close:

| Layer | Why it's 2D-bound |
|---|---|
| Renderer | `WeaselRenderer` calls `gl.disable(gl.DEPTH_TEST)` in two places; batching and ordering assume painter's-order back-to-front with premultiplied alpha |
| Camera | `View` is `{x, y, scale:{x,y}}`; `viewToMat3` emits `[sx,0,0, 0,sy,0, tx,ty,1]` — no rotation, let alone projection |
| Geometry | earcut is a 2D polygon triangulator; caches are 2D notions (stroke outlines, gradient ramps, text layout) |
| Hit-testing | point-in-polygon and AABB, not ray casts |

## Phases

**Phase 0 — genericize `ToolCtx`.** The prerequisite, and the only phase with a
standalone payoff. Tracked in `docs/TODO.md` under Tools & gestures. Until
`worldX`/`worldY` and `view` are type parameters, a 3D kernel reuses routing
and undo and then rewrites every tool.

**Phase 1 — labkit `surface?` capability.** Independent of Phase 0, and the
phase that unblocks real 3D labs *without any 3D kernel at all*. labkit's
`Instrument` is already a capability declaration (`canvas?`, `layers?`,
`dragDrop?`, `undo?`). Add a third viewport backend alongside `canvas?`
(imperative 2D) and `scene?` (weasel `SceneCanvas`): `surface?`, where the
instrument owns the GL context and labkit supplies rect, DPR, dirty-marking,
and scheduling. One `Workspace`, one set of chrome, three backends.

This is what klieg's tube lab needs — sixteen panels from one `WebGLRenderer`
with scissor rects and `preserveDrawingBuffer`, because sixteen canvases would
exhaust the context budget. It brought its own renderer already; it only needs
labkit to stop demanding a canvas per tile. See `packages/labkit/docs/IDEAS.md`
("Panels over one GPU context"), which poses the same question and gets the
same answer: labkit stays backend-agnostic and owns rects, dirtiness, and
scheduling.

**Phase 2 — a 3D kernel package.** Own renderer, camera, and ray picking;
depends on `gestures` + `history`; reuses the tool authoring model from Phase 0.
The open build-vs-adopt question is whether the renderer is bespoke or three.js
wearing a weasel-shaped adapter — the labs that motivated this are already on
three.js, which argues for adopt.

## What "shipping tools for both" actually means

Not one tool with two implementations. Tools are already declarative shells —
`useRectTool` is 45 lines with **zero geometry**: an id, capabilities, a
cursor, presentation metadata, and one binding, `{kind: 'drag'} → actionId:
'insert'` with `params: {kind: 'rect'}`. Nothing in that file is 2D.

The 2D-ness lives entirely in the layer below: `insertAction` (tracks live
bounds, paints the preview) and the `insert` dep (mints the node). So the split
is **tools ship once; actions and deps ship per kernel** — a 3D kernel supplies
its own `insert` action and dep, and the shape tools transfer verbatim,
presentation and icons included.

Two qualifications. Viewport tools are the exception: `useHandTool` routes to
`viewport.dragPan`, and a 3D kernel wants orbit/dolly as distinct intents, so
its binding differs even though the shell is the same shape. And tools with
thunked binding params read live state through them — those params are scalars
(a side count, a mode) rather than geometry, so they are expected to transfer,
but they are the place to check first.

This is a consequence of the 2026-07-28 phase-table retirement, which left
tools as bindings only. That refactor bought dimension-portability without
anyone intending it.

## How much of `Scene` is dimension-neutral (audited 2026-08-22)

**All of it.** The audit question is closed, and the answer moves the boundary.

`Scene`'s entire interface is ids, layers, parenting, ops, history,
serialization, and subscription. `setPose(id, pose: TPose)` and
`update(id, {data: TData})` are generic; there is no bounds method, no
hit-test method, and no geometry method on `Scene` at all. `scene.ts` is
1000+ lines and contains **no pose math** — its only `Math.min`/`Math.max`
calls clamp child and layer indices during reorder. `RectPose` is merely the
default type argument (`TPose = RectPose`), and the docstring already says
`TPose` is fully generic.

The layer above it holds the same line. Pose-to-geometry is an **injected
function** at every site:

- `composeWorldPose<TPose>(adapter, id, compose)` walks ancestry and folds; the
  pose math arrives as the `compose` callback. `composeRectPose` is a separate,
  swappable default.
- `poseBounds?: (pose: TPose) => Bounds`, `boundsOf?: (id) => Bounds | null`,
  `pickBest?`, `pickEvery?` — all consumer-supplied.
- `resizePolicy.ts` gates 2D-only options behind conditional types
  (`TPose extends ResizePose ? … : never[]`), so a non-2D pose already
  type-errors its way out of them.

So Phase 2 reuses the scene graph. It does not need a second one.

### Where the real boundary is: `Bounds`

`Bounds` is `{x, y, width, height, rotation?}` — a 2D AABB with a 2D rotation —
and it appears in **92 non-test files**. It is the *output* type of every
injected pose function above, so the injection seams stop at it: you can supply
any `TPose` you like and still must return a 2D box.

Two smaller leaks in the same family:

- **Flat coordinate scalars.** `pickBest(worldX, worldY, alt, sel)` repeats
  `ToolCtx`'s `worldX`/`worldY` shape — no point type to swap. Phase 0 should
  fix both together; they are the same defect.
- **23 hard casts to `RectPose`** across 5 non-test files
  (`interactions/actions/defaults/move.ts`, `defaults/group.ts`,
  `canvas/NodeShape.ts`, `canvas/deps/editAnchors.ts`,
  `canvas/SceneCanvas/useSceneSelectTool.ts`). These bypass the generic seam
  outright and would each need a policy hook or a conditional-type gate.

**Revised Phase 0 scope:** genericize `ToolCtx`, `pickBest`/`pickEvery`, and
`Bounds` together — `Bounds` is the widest of the three and the one that
decides whether the rest is worth doing. Retire the 23 casts alongside it.

## Remaining open question

**Does selection/overlay chrome transfer?** Handles are screen-space in both
kernels, so the overlay may port further than expected. Untested.

## Non-goals

- Rotation in the 2D camera. `View` stays affine and axis-aligned; multi-view
  setups differ by pan/zoom region, not angle. Content rotation lives in poses.
- Any change to `@weasel-js/core` in service of 3D. If a phase needs one, that
  is a signal the boundary moved and this doc is wrong.
