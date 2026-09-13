# Introducing 3D to weasel

Direction doc for a weasel maintainer deciding how 3D would enter the project.
It answers one question: **where does the boundary go?** — and phases the work
behind it. It is not an implementation plan. Phases 0, 1 and 2 are built.

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

**Phase 2 — a 3D kernel package that hosts a renderer rather than owning one.
Built.** `packages/kernel3d`: `Pose3`, an orbit camera, ray picking, the dep
adapters, and the screen-projected chrome geometry weasel's 2D `Bounds` speaks.
The consumer brings the renderer. Its math — vectors, quaternions, 4x4 matrices,
ray intersection — went into `@weasel-js/geom/3d` rather than the kernel, because
none of it carries a camera or a scene and geom is where geometry lives.

**It is a consumer of core, not a sibling of it.** This doc originally said
sibling, depending on `gestures` + `history` only. That was written before the
lab, and the lab settled it the other way: the kernel reuses core's `Scene`, its
dispatcher, its actions, `resolveOverlays` and the pose feed, and every one of
those lives in core. Lifting `Scene` out instead is not cheap — `RectPose` is
*declared inside* `core/scene/types.ts` and imported back by
`geometry/unionBounds.ts` and `features/groups/composePose.ts`, so a scene
package and core would import each other. So `kernel3d` takes core as a peer,
the tier `svg`, `diagram` and `loupe` already occupy. Core still takes no diff,
which is the constraint that mattered.

Its prerequisite — making the action pipeline generic over point, camera and box
— dissolved. `useGestureDispatcher` takes a `clientToWorld` hook and a 3D host
passes identity, so `ctx.world` carries the screen point and each dep rebuilds
the ray from the camera it already closes over. `InvocationCtx` needs no point
type parameter at all.

Two things the promotion had to fix, neither visible at lab scale.
`projectAabbToScreen` dropped corners behind the camera rather than clipping the
edges, which reports a box too small for anything straddling the near plane and
near nothing for a solid the camera is inside; it now clips all twelve edges.
And the seam saying how big a node is asks for its *world* box, not a local box
to transform — a sphere's box is the same under every rotation, and no transform
of a local box reproduces that.

One measurement gap closed on the way: nothing had asserted that a quaternion
pose survives `toJSON`/`sceneFromJSON`. It does.

One 2D leak in `Scene` that the "all of it is dimension-neutral" audit missed:
`kitRegistry.ts` registers `unionOfChildren` into every scene with two blind
`as unknown as RectPose` casts, so a 3D scene carries a registry entry that
would produce garbage if a node opted into it via `derivePoseKey`. The escape
hatch is real — `unionOfChildrenVia(descriptor)` shadows it under the same key —
but the default is 2D and silent.

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

**`PoseDescriptor` fits, once a depth is chosen.** Read `Bounds` as the screen box
a solid covers and `getBounds` and `intersectsRect` work — that is what drives the
lab's chrome, and it tracks the camera through an orbit. `remapBounds` and
`fromBounds` run the other way and named no depth, so they threw. **Decided
2026-09-13: the depth is the pose's own** — both resolve the rectangle on the
plane through the pose they were handed, facing the camera, so neither changes
depth, and a resize scales uniformly because two screen extents cannot name
three. The descriptor's other gap is closed: `forNode` hands it the node, so a
sphere bounds itself as a sphere.

**`ViewApi` is the one real dead end.** Pan and scale with no orientation; an orbit
camera does not fit. The lab declares a `camera3d` dep of its own by augmenting
`DepSchema`. This is the viewport-tool exception this doc predicted, and it stayed
the only one.

**Chrome transfers as geometry, and now as code.** The projected-AABB math was
right and the outline tracked the camera from the start. The overlay half of the
in-flight channel followed: `resolveOverlays` answers what a marquee, a lasso or
an insert preview is proposing, in world geometry with no renderer in it, and the
lab draws its marquee and its uncommitted box from the same call `<SceneCanvas>`
uses. One variant does not port and cannot: `slice` and diagram's `connect` bake a
`PathDrawCommand` inside the action, so the geometry is destroyed before any layer
sees it.

labkit's shared buffer is no longer the constraint either — it is two buffers now,
stacked around the trial DOM, and an opaque tenant asks for the one underneath.

### Three things that cost the most time, none of them about dimensions

**Mounting tools outside `<SceneCanvas>` is a registration contract nobody states.**
A tool's own actions ride on its definition and something has to register them, and
nothing does it for you. The second half of this, as first written, was wrong:
`select.pick`'s `eligible: { capability: 'creates-selection' }` does not resolve
through the `activeTool` dep. `checkCapability` reads `RuleCtx.allowedCapabilities`,
which reaches the dispatcher only via `getRuleCtx` — so with `getRuleCtx` unset every
eligibility rule is skipped and the action fires. `docs/extending.md` now states
both halves.

**`classifyTarget` says world and means client.** Re-checked at runtime on
2026-09-12, which overturns what this section said before: the point does not
arrive in two different spaces depending on the path. All four call sites pass
the raw client point; it is the action's `ctx.world` that goes through
`clientToWorld`, so a consumer hit-tests in two spaces and the option's type
named the wrong one. `<SceneCanvas>` and `<CanvasView>` both convert inside
their own thunk. The lab keeps `clientToWorld` identity, which collapses the two
spaces into one and is why its deps can subtract the pane origin exactly once.

**`Scene` owned a `History` and exposed no handle to it.** `undo()` and `redo()` were
on the scene, but the kit's `undo`/`redo` *actions* want the `history` dep, and a
consumer had nothing to give them. `scene.history` is that handle — a façade rather
than the private engine, because the scene's own wrappers are what suppress
re-recording and notify React.

### What this says about the fork

The routing layer never fought. Every failure above was a dep contract, a
registration step, or a coordinate-space bug — not binding-to-action routing, and
not `InvocationCtx`. That is the case for extracting routing into a package beside
`gestures` and `history` rather than giving a 3D kernel its own dispatcher, and it
puts the seam at `depSchema.ts`: the mechanism is portable, the schema is 2D.

## The renderer is the consumer's (decided 2026-09-13)

The kernel owns `Scene`, poses, the dep adapters, ray picking and chrome
geometry. It does not ship a renderer, and it does not depend on three.js.
A consumer brings its own and the kernel hands it poses.

Three measurements from the lab, not preferences:

- **The renderer is already a leaf.** `deps3d.ts` imports `math3d` and
  `camera3d` and nothing from `renderer3d`; `overlays3d.ts` takes one
  structural rect type from it. Only the host — `SolidInstrument.tsx` — draws.
  The kernel's substance never sees a renderer.
- **Both motivating consumers already own a `WebGLRenderer`.** klieg's tube lab
  and precioussss's gem bench brought three.js with them. A kernel shipping a
  second renderer means two renderers and two scene graphs in one app.
- **labkit's surface layer exists to host a renderer it does not own.** That is
  what `useTiledSurface`, `toDeviceRect` and the two stacked buffers are for.

**The kernel's math types stay weasel's own** — immutable tuples, not three's
mutable classes. `History.serialize()` promises a structured-clone-safe form and
the async lab storage persists it to IDB; `structuredClone` keeps a class
instance's data and drops its prototype without throwing, so a `Vector3` in a
pose would return from a reload as a bare `{x, y, z}` whose first method call
throws far from the cause. Mutability is the second hazard: history stores pose
snapshots, and `pose.position.add(delta)` would write through the undo record.

Adopting three's types buys little because interop is nearly free. `Vector3`,
`Quaternion` and `Matrix4` all carry `fromArray`/`toArray`, and all three agree
with our layout already — column-major matrices, `[x, y, z, w]` quaternions.
`PoseDescriptor<Pose3>` is the only kernel signature that carries our math types
outward; every dep speaks core's 2D `Bounds` and screen points, with the 3D math
inside the closure.

The line where adopting three stops being cheap is picking, not math.
`Ray.intersectBox` is a direct swap for `intersectRayAabb`. `Raycaster` is not:
it walks `Object3D`s, so using it puts three in charge of the scene graph, which
is the one thing `Scene` owns.

Its pose feed is specified in `2026-09-13-pose-feed-design.md`: the feed lives
in core rather than the kernel, publishes added / removed / changed with
effective poses, and reads the scene's two clocks so a drag never walks the node
map.

## Settled

**Where routing lives.** Every fight was a dep contract, a registration step or a
coordinate-space bug — never binding-to-action routing. So routing moved into
`@weasel-js/routing`, beside `gestures` and `history`, rather than a 3D kernel
getting its own dispatcher; the seam is `depSchema.ts`, and `@weasel-js/core`
depends on the package — 6,302 lines across 31 files.

## Non-goals

- Rotation in the 2D camera. `View` stays affine and axis-aligned; multi-view
  setups differ by pan/zoom region, not angle. Content rotation lives in poses.
- Any change to `@weasel-js/core` in service of 3D. If a phase needs one, that
  is a signal the boundary moved and this doc is wrong.
