# Introducing 3D to weasel

Direction doc for a weasel maintainer deciding how 3D would enter the project.
It answers one question: **where does the boundary go?** — and phases the work
behind it. It is not an implementation plan. Phases 0 and 1 are built; Phase 2
is unscheduled, and a lab is being built to settle its open questions.

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
finger counts, modifiers, `channel:phase` tool routing. Its specs and target
matching carry no coordinates. Its event types do: pointer events carry `x`/`y`
and clicks carry `worldX`/`worldY` (`ui/inputEvent.ts`) — see Phase 2's
prerequisite.

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

**Phase 0 — one pose descriptor. Built.** Built-in actions, painters and chrome
read one consumer-supplied `PoseDescriptor` instead of assuming a pose is
`{x, y, width, height}`; `<SceneCanvas poseDescriptor>` supplies it and the
`poseDescriptor` dep carries it. It paid off in 2D on its own — a pose without
top-level `x`/`y` used to take `NaN` when dragged into a container.
`ToolCtx` was not part of it: since tools became bindings only, its sole reader
is the function form of `Tool.cursor`, and the tool files carry no geometry.

**Phase 1 — labkit's shared tiled surface. Built.** `packages/labkit/src/surface/`:
`useTiledSurface` for the host that owns the renderer, `useSurfaceTile` for each
pane that wants a rect on it. The instrument owns the GL context; labkit supplies
rect, DPR, dirty-marking and one `useVisibleRaf`. Independent of Phase 0, and the
phase that unblocks real 3D labs *without any 3D kernel at all*.

It is reached by hooks, not by a declared capability. An earlier draft of this
doc called it a `surface?` capability sitting beside `canvas?` and `scene?` —
neither exists. `Instrument` declares `canvas`, `layers`, `dragDrop`, `undo`,
`tools`, `annotations`, `loupe`, `chrome` and `job`; a surface tenant calls the
hooks from inside `render`, and a host that wants to own the buffer mounts
`useTiledSurface` above `<Lab>`, which then mounts none of its own.

This is what klieg's tube lab needs — sixteen panels from one `WebGLRenderer`
with scissor rects and `preserveDrawingBuffer`, because sixteen canvases would
exhaust the context budget. It brought its own renderer already; it only needs
labkit to stop demanding a canvas per tile. See `packages/labkit/docs/IDEAS.md`
("Panels over one GPU context"), which poses the same question and gets the
same answer: labkit stays backend-agnostic and owns rects, dirtiness, and
scheduling.

**Phase 2 — a 3D kernel package.** Own renderer, camera, and ray picking;
depends on `gestures` + `history`; reuses the tool authoring model.

Its prerequisite is making the action pipeline generic over point, camera and
box. World coordinates enter as `{x, y}` or flat scalars in `InvocationCtx`
(`interactions/actions/invoker.ts`), in the dep payloads (`depSchema.ts`:
`ViewApi`, `NodeAtPointDep`, `SnapDep`, `InsertDep.commit`, `AreaSelectDep`),
in the pick functions, and in `@weasel-js/gestures`' pointer and click events.
In 3D a pointer is a ray, so what replaces the world point is decided with the
picking design, not ahead of it.

The working hypothesis, being tested by the 3D lab
(`docs/superpowers/specs/2026-09-12-3d-lab-design.md`): nothing replaces it.
`useGestureDispatcher` takes a `clientToWorld` hook, and `<SceneCanvas>` passes
a function that inverts the 2D view transform. A 3D host passes identity, so
`ctx.world` carries the screen point, and each dep rebuilds the ray from the
camera it already closes over. If that holds, `InvocationCtx` needs no point
type parameter at all and the prerequisite shrinks to the deps.
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
- `boundsOf?: (id) => Bounds | null`, `pickBest?`, `pickEvery?`, and the pose
  descriptor — all consumer-supplied.
- `resizePolicy.ts` gates 2D-only options behind conditional types, so a
  non-2D pose already type-errors its way out of them.

So Phase 2 reuses the scene graph. It does not need a second one.

### Where the real boundary is (re-audited 2026-09-11)

Two places, and they are separate problems.

**The pose seam leaks.** A consumer describes pose geometry in seven separate
options, each with its own rect-assuming default, and built-in actions and
painters bypass all of them by reading `x`/`y`/`width`/`height` directly.
Phase 0 fixes this.

**Coordinates are 2D across the action pipeline.** See Phase 2's prerequisite.
`Bounds` (`{x, y, width, height, rotation?}`) is part of this, and larger than
an earlier count in this doc claimed: 70 non-test files reference it, 52 of them
in core, and 49 import it as a type.

## What the 3D lab found (2026-09-12)

`packages/labkit/examples/3d-lab` runs a WebGL viewport on core's dispatcher,
actions and select tool. Orbit, ray-pick, select, move across the ground plane,
drag-to-insert and undo all work, and **core took no diff**. What follows is
measured, not argued.

**The world point needs no replacement.** This was the question Phase 2 was
parked behind, and the answer is that nothing changes shape. `useGestureDispatcher`
takes a `clientToWorld` hook; the lab passes identity, so `ctx.world` carries the
screen point, and each dep rebuilds the ray from the camera it already closes
over. Picking, marquee, insert and move are all driven by two numbers. There is
no `Ray` in `InvocationCtx` and no point type parameter.

**`Scene` really is dimension-neutral.** It holds `Pose3` — position, quaternion,
scale — and `setPose` plus undo round-trip it. Previously audited, now run.

**`InsertDep.commit(bounds, extras)` survives.** A screen rectangle plus a ground
plane determines a box: the depth the 2D contract cannot express comes from the
scene, not the caller.

**`PoseDescriptor` half-fits.** Read `Bounds` as the screen box a solid covers and
`getBounds` and `intersectsRect` work — that is what drives the lab's chrome, and it
tracks the camera through an orbit. Two things do not. `remapBounds` and
`fromBounds` run the other way, and a screen rectangle does not name a 3D pose
without a depth, so the lab throws rather than guess. And the descriptor is handed
a *pose*, never the node, so it cannot tell a sphere from a box and bounds
everything as a box.

**`ViewApi` is the one real dead end.** Pan and scale with no orientation; an orbit
camera does not fit. The lab declares a `camera3d` dep of its own by augmenting
`DepSchema`. This is the viewport-tool exception this doc predicted, and it stayed
the only one.

**Chrome transfers as geometry, not as paint.** The projected-AABB math is right and
the outline tracks the camera. But labkit's shared buffer is `z-index: 1` — above
the instrument's DOM — so an opaque 3D tile buries anything drawn in the pane, and
the lab paints its own outline in GL. Whether core's overlay *code* ports is still
untested.

### Three things that cost the most time, none of them about dimensions

**Mounting tools outside `<SceneCanvas>` is a registration contract nobody states.**
A tool's own actions ride on its definition and something has to register them;
`select.pick` is additionally gated on `eligible: { capability: 'creates-selection' }`,
which resolves through the `activeTool` dep. Miss either and clicks select nothing,
with no error — the actions are simply never eligible.

**`classifyTarget` says world and means client.** Re-checked at runtime on
2026-09-12, which overturns what this section said before: the point does not
arrive in two different spaces depending on the path. All four call sites pass
the raw client point; it is the action's `ctx.world` that goes through
`clientToWorld`, so a consumer hit-tests in two spaces and the option's type
named the wrong one. `<SceneCanvas>` and `<CanvasView>` both convert inside
their own thunk. The lab keeps `clientToWorld` identity, which collapses the two
spaces into one and is why its deps can subtract the pane origin exactly once.

**`Scene` owns a `History` and exposes no handle to it.** `undo()` and `redo()` are
on the scene, but the kit's `undo`/`redo` *actions* want the `history` dep, and a
consumer has nothing to give them.

### What this says about the fork

The routing layer never fought. Every failure above was a dep contract, a
registration step, or a coordinate-space bug — not binding-to-action routing, and
not `InvocationCtx`. That is the case for extracting routing into a package beside
`gestures` and `history` rather than giving a 3D kernel its own dispatcher, and it
puts the seam at `depSchema.ts`: the mechanism is portable, the schema is 2D.

## Still open

**Does core's selection overlay port?** The lab answered the geometry and not the
painting.

**Bespoke or three.js.** Untouched. The lab wrote its own picking to learn what a
kernel would owe, and that debt turns out to be small.

## Non-goals

- Rotation in the 2D camera. `View` stays affine and axis-aligned; multi-view
  setups differ by pan/zoom region, not angle. Content rotation lives in poses.
- Any change to `@weasel-js/core` in service of 3D. If a phase needs one, that
  is a signal the boundary moved and this doc is wrong.
