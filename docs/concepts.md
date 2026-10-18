# Concepts

The mental model behind `@weasel-js/core`. Read this before writing code.

## `<Canvas>`

> `<Canvas>` is `@internal` and not exported from the public barrel.
> Consumers use `<SceneCanvas>`, which mounts it.

A single `<canvas>` element wired up: it owns DPR setup, layer composition,
and the pointer-event router. It composes layers that are already built
(`CanvasLayers`) and knows nothing of a scene; `<SceneCanvas>` builds those
layers from its `scene` and `layers` props, and selection, picking, the kind
registry, and the scene-aware overlays live there.

There are no controller-override props.
Move, resize, rotate, insert and area-select are actions in the Actions
Registry; you change what they do by binding different gestures to them, by
passing behaviors through a binding's `opts`, or by registering your own
descriptor under the same id. See [hooks.md](./hooks.md),
[extending.md](./extending.md), and `packages/core/src/canvas/Canvas.tsx`.

### Paint and render are separate

The canvas paints from its own animation frame, not from a React render.
`requestRedraw()` marks it dirty and the next frame paints, so many redraws in
one tick cost one paint. A view written through `setView()` on the
`<SceneCanvas>` ref costs no React render at all — `getView()` reads it back
mid-frame, `subscribeView()` reports changes. A canvas holding a `view` prop is
controlled instead: `setView()` refuses the local write, warns once, and
forwards the value to `onViewChange`, so the owner's render is still paid.

Pixels and DOM can therefore be a frame apart, and pixels lead both times. What
differs is what it takes to bring the DOM along:

- **A view change leads with pixels.** `setView()` writes a ref and paints on
  the frame without rendering at all, so DOM built from the view stays stale
  until something else re-renders it. Position DOM pinned to world coordinates
  from `subscribeView`, and it moves on the frame the pixels move.
- **A scene change also leads with pixels.** `<SceneCanvas>` repaints on a scene
  write without re-rendering itself: the layers read the scene at paint time, so
  nothing about drawing the new content needs a commit. DOM built from scene
  data comes from whoever subscribed for it — `useScene`'s default, a panel's
  own subscription — and lands on that subscriber's render, not the canvas's.
  Chrome that must be in lockstep compares `getPaintedVersion()` — the content
  version the pixels were painted from — against the version it is about to
  render, and defers a frame when they differ. It reads `0` until the first
  paint lands, which is not a version any scene has; treat it as "nothing
  painted yet" rather than comparing it.

  So under `useScene(…, { subscribe: false })` a host driving poses from a
  frame loop pays no render per write.

For readouts and panels either skew is invisible. Reading the drawing buffer
back outside a paint can likewise see the previous frame; `subscribeFrame()`
runs on the frame that painted. `syncPaint` restores painting at commit time.

Nothing paints while `document.hidden` is true, `syncPaint` included — a
background tab still commits React updates, and a sync paint is the one path
the browser's own frame throttling does not stop. A buffer read back from a
hidden tab therefore returns the frame from before the tab was hidden. The
dirty flag holds until `visibilitychange` brings the surface back.

**Do not render scene-derived DOM inside `startTransition`.** React defers a
transition deliberately and nothing forces it to catch up, so that DOM can
diverge from the canvas without bound, and nothing warns — React exposes no way
to ask whether the current render is a transition. Render that DOM outside the
transition, gated on `getPaintedVersion()` when it must be in lockstep, or set
`syncPaint`.

## What `<SceneCanvas>` turns on

A bare `<SceneCanvas>` renders its scene and nothing else. The `selection`
API works, so a consumer binding has a selection to act on, but no input sets
it. There is no tool and no active tool, no standard action and no key, no
clipboard, no drop or paste, and no selection chrome. The gesture dispatcher is
mounted, so a binding a consumer adds — an `ambient` entry, a tool, an action
with a `defaultBinding` — routes as usual, with no base tool ahead of it.

Behavior is turned on by naming presets in `features`. Each is independent:

| Preset | Registers |
|---|---|
| `view` | wheel pan and zoom, pinch, the zoom keys; the hand tool, held on Space |
| `select` | the select tool, as the initial active tool and Escape's return target |
| `outline` | the selection outline, whichever tool sets the selection |
| `pick` | `select` and `outline` |
| `move` | ambient drag-to-move and Alt-drag-to-clone bindings |
| `resize` | the resize handles, drawn and bound |
| `rotate` | the rotation handle, drawn and bound |
| `transform` | `resize` and `rotate` |
| `edit` | undo/redo, delete, duplicate, group/ungroup, nudge, select-all, Escape, cancel-gesture, clipboard, fill and stroke, and their keys; Cmd/Ctrl+V pastes nodes a kit canvas copied, and nothing else |
| `arrange` | align, distribute, reorder, flip |
| `paths` | pathfinder operations, path-edit entry, anchor editing |
| `ingest` | dropped and pasted content: images, SVG, files, and consumer content handlers, on Cmd/Ctrl+V or an OS drop |
| `draw` | every preset above |

`FEATURE_ACTION_IDS` is the table of which kit action each preset registers,
and `COMPOSITE_FEATURES` of what `pick`, `transform` and `draw` abbreviate.
Each name stands for a `FeaturePreset` object (`selectPreset`, `pathsPreset`,
…), and `features` takes those objects, or a package's own, beside the names;
`docs/extending.md` ("Presets") has the shape. A
canvas supplying its own select tool names `outline` rather than `pick`, so the
built-in one is not mounted beside it.
Passing `viewport` implies `view`; the prop only configures it. A tool brings
the kit actions it binds, so `defaultTools={['rect']}` registers `insert`
under any preset, and `actions` adds, overrides or removes on top of all of it.

`move`, `resize` and `rotate` belong to the selection, not to the select tool:
they are always-live entries (`selectionMoveContribution`,
`selectionResizeContribution`, `selectionRotateContribution`), so a drag on the selection moves it under
any tool that leaves the drag unclaimed. The select tool itself only chooses:
it picks on press, marquees on an empty drag, and clears on an empty click.

## `<SceneViewCanvas>` and `<MinimapCanvas>` (detached views)

Three primitives can render a second view of a scene. Pick by where the
inset lives and whether it's interactive:

- **`<SceneViewCanvas>`** — a pointer-inert, read-only `<canvas>` that
  renders a `Scene` at an arbitrary `view`. Has its own GL context and DOM
  node. Use for thumbnails, side-by-side previews, printable snapshots, or
  any second view that doesn't accept input.
- **`<MinimapCanvas>`** — `<SceneViewCanvas>` plus a viewport-rectangle
  indicator and click/drag-to-recenter against a `mainView` callback. Use as
  a navigation widget in a sidebar/panel — a distinct DOM location from the
  main `<SceneCanvas>`.
- **`createViewportLayer`** — renders an inset *inside* the main
  `<SceneCanvas>`'s drawing buffer (superimposed PiP). Use when the inset
  must live as pixels in the main canvas, e.g. for a screenshot-stable
  minimap or a print-included overview.

With no scene at all, **`<DrawCanvas>`** paints a `DrawCommand` list (or a
function returning one) onto the same kind of detached surface: sized in CSS
pixels, DPR-correct, repainting behind the visibility gate. It is for drawing
something that has no scene, like a package that knows nothing of scenes. Where
a scene exists, render it with one of the components above.

```tsx
import { MinimapCanvas, SceneCanvas, useScene, useSelection } from '@weasel-js/core';
import { useState } from 'react';
import type { View } from '@weasel-js/core';

function App() {
  const scene = useScene<Data, Layer, Pose>({ systemLayers: [{ id: 'default' }] });
  const selection = useSelection();
  // Named apart from the ref's `setView()`: a `view` prop makes both canvases
  // controlled, so every camera move here is a React render.
  const [view, setMainView] = useState<View>({ x: 0, y: 0, scale: { x: 1, y: 1 } });

  return (
    <>
      <SceneCanvas
        width={600} height={400}
        scene={scene} selection={selection}
        view={view} onViewChange={setMainView}
        layers={{ scene: { drawOne: (n, p) => [/* … */] } }}
      />
      <MinimapCanvas
        scene={scene}
        mainView={view}
        mainViewDims={{ width: 600, height: 400 }}
        onMainViewChange={setMainView}
        width={200} height={140}
        drawOne={(n, p) => [/* stripped-down minimap variant */]}
        fit="scene"
      />
    </>
  );
}
```

A view *inside* the main canvas is a `<CanvasView>` instead.

## Adapter

An **adapter** is the object the interaction layer reads a scene through
(`getNodes`, `getPose`, hit-tests, selection) and writes it back through (the
mutators ops apply). `<SceneCanvas>` builds one from the scene you give it, so
most apps never hold one; `useSceneAdapter(scene)` builds the same thing for
whatever sits outside the canvas, such as a pose animation. A flat list of
items is a scene too: `useScene({ items })`.

Each reader asks for a narrow slice of the contract (`MoveAdapter`,
`ResizeAdapter`, `InsertAdapter`, `AreaSelectAdapter`, `RotateAdapter`), and
the scene's adapter satisfies all of them. A store the kit does not own gets a
hand-written adapter implementing the slices its readers take. See
[adapters.md](./adapters.md).

## Pose

A **pose** is the snapshot of an object the kit reads and writes. Its shape
is up to you — generic over `TPose`. The common case is a rect:

```ts
interface Pose { x: number; y: number; width: number; height: number }
```

Other shapes ship: `RotatedPose` (rect + `rotation`), `Path` (the kit's
polygon/cubic-bezier representation), `TextPose`. For non-rect poses, supply
a `PoseDescriptor<TPose>` (see [extending.md](./extending.md)) so the
rect-flavored math (resize, area-select, snap origin) still works.

`getPose` / `setPose` are **local-coordinate** — relative to the object's
parent — and `getWorldPose` is the composed reading that rendering, picking and
chrome consume. The two are the same value unless the scene composes poses: by
default a parent groups its children and imposes no transform, so every node's
stored pose is already world. Pass
`useScene({ composition: RIGID_POSE_COMPOSITION })` to make a container's pose
a frame, so rotating it rotates its contents and moving it writes one pose. The
scene holds the strategy as `scene.composition`, and the canvas, the adapter,
the layout pass, picking, and every built-in action read it from there.

## Pose override

A node's **pose** is document state: undoable, serialized, the answer to "where
is this". A pose **override** is the same value for one frame — `scene.overrides`
holds a per-node `{ pose?, alpha?, path? }` that the render and hit-test paths read
through, and that history and `toJSON()` never see. A 60 Hz camera, a drag
preview, a physics settle and an animation tween all want this: motion that is
not an edit.

```ts
const entry = { pose: { x: 0, y: 0, width: 16, height: 16 } };
scene.overrides.set(id, entry);   // once

// per frame
entry.pose.x = simulation.x;      // mutate in place — no allocation
scene.overrides.commit();         // publish
```

The painter memo keys on pose *reference*, so an
in-place mutation without a commit paints the previous frame and reports no
error. `commit()` drops the pose-keyed memo slots of every overridden node.

To promote a frame to document state — dropping a drag, baking a settle — write
it once through `setPose` and `clearAll()`. That is the one step that belongs in
the undo stack.

## Animation target

A **target** is one value the animator can move. Its owner says how to read and
set the **committed** value, what shows when nothing is animating, and the
animator takes `target` in place of `onTick` on `tween`, `spring`, `physics`,
and `decay`.

```ts
const x = createTarget<number>({ get: () => box.x, set: (v) => { box.x = v; }, show: draw });
animator.tween({ target: x, to: 100, ms: 300 });
// 150 ms later, from anywhere:
animator.spring({ target: x, to: 40 });   // bends the motion; neither cancels the other
```

Two animations that each write a value through `onTick` are last-writer-wins.
Two on one target combine, by two rules:

- **An offset adds.** A tween or spring commits its destination as it starts and
  contributes only what it has left to travel, so `target.read()` is the
  committed value plus every offset. A coast has no destination and commits
  where it stops.
- **A hold stands in.** `animator.hold({ target, value, weight })` shows a value
  in place of the committed one: a drag preview, a timeline's sampled track, a
  rig clip. Several holds on a target are alternatives, mixed by weight; weights
  short of 1 leave the rest to the committed value. On an
  angle axis the holds meet at their average direction by weight, so two turn the
  short way toward each other. A hold given `axes` holds only those, each by
  the target's name for it or by index: `axes: ['y']` on a point, and a rig's joints by name, so
  an arm solved by IK sits beside the clips holding the rest of a rig.
- **A hold covers the committed value on its way too.** The move a destination
  makes in the committed value is behind the hold, by the hold's weight on each
  axis: `tween({ target, to })` under a full hold shows nothing, and under one at
  0.5 shows half its travel, with no jump as it starts. What an animation shows
  apart from that move rides on top of the hold at full: a coast, a spring pushed
  where it stands, and a `from` away from the committed value, such as a recoil
  over a rig clip.

Leaving never moves the value on screen: a canceled animation commits where it
was, and so does a released hold unless told not to. A hold released that way
takes with it the share it covered of each move behind it, so a tween under a
full hold stays where the hold put the value and does not then play out. What
was riding on top of a hold when its animation stopped stays on screen
beside the hold; it is committed when the target's last hold goes, or taken up by
the next animation given a destination. Under one `cancelKey` a new
animation still interrupts the old, and a spring starts at the velocity of what
it interrupts; `interrupt: false` shares the key and adds. When something else
writes the committed value mid-flight, call `target.stop({ commit: false })` so
the writer wins.

A pose move can follow an undo instead: `tweenPose` and `springPose` given
`rewind: true` travel back to where they began when the move is undone mid-flight,
and forward again if it is redone on the way.

What is built on it:

| Value | Its target | Moved by |
|---|---|---|
| A node's pose | `adapter.poseTarget(id)`: `scenePoseTarget(scene, id)` over a scene, `createWrittenPoseTarget` over a store with no overrides | `tweenPose`, `springPose`, `animateOnSetPose`, reflow glides (`reflowTransition`, and `poseTransition` for any write the scene reports), momentum |
| The camera | `ViewAnimationApi.viewTarget`; on a `<SceneCanvas>` ref, `camera.target` | `useViewAnimation`, `animateView`; add a shake on the same animator, which the ref hands out as `camera.animator` |
| Vertex colors | `colorOverrides.target(id, channel, length)` | `tweenVertexColors`, `springVertexColors`, `staggerVertexColors` |
| A rig's pose | `rig.target` | clips: a `SampledTrack<Pose>` given `target` and `weight` |
| Anything else | `createTarget({ get, set, axes?, show? })` | any of the above primitives |
| Many like values | a row of `createTargetTable({ axes })` | any of the above primitives, on `table.target(row)` |

A pose animation over a scene therefore writes the document once, at its start,
and shows its travel through a pose override. A hand-written adapter's store has
no overrides, so `createWrittenPoseTarget` writes it the pose on screen each frame
while the target keeps the committed pose. The values are computed by blits
(`@msb235/blits`), behind `packages/animator/src/engine/`; no blits type is
public. blits clocks the voices and sums them; how a target's holds share it is
folded here, in `engine/holds.ts`, since blits weighs a voice whole and a hold can
cover some axes and turn an angle. blits stays a repository of its own, not a
`@weasel-js` package. A target is moved by one animator at a time.

Thousands of like values go in a **target table**, where a target apiece would
cost a read apiece:

```ts
const dots = createTargetTable({ axes: 2 });          // each row is [x, y]
const row = dots.add([10, 20]);
animator.tween({ target: dots.target(row), to: [300, 40], ms: 400 });
// after each frame, every row's value on screen, back to back:
upload(dots.shown);
```

A row is a target like any other. Its committed value lives in `table.committed`,
and the animator fills `table.shown` for every moving row in one pass over flat
arrays, about 3 ns a row. `shown` is a `Float64Array` unless the table is made with
`shown: Float32Array`, for a painter that uploads it as it stands.

A reader of many targets that wants numbers calls `target.readInto(out, at)`, which
writes the value's `axisCount` axes into a buffer and builds no value. Axes that
define `add` and `write` let a read skip the array of axes as well; the ones the
kit supplies all do.

## Clip

A timeline's tracks hold functions and live targets, so a timeline is not data. A
**clip** is one that is: `{ version: 1, tracks, duration? }`, with keys, easings by
built-in name or bezier points, and a name wherever the live timeline holds a
function or a target.

| In a live track | In a clip | Resolved by |
|---|---|---|
| `target` | `target: 'pose:box'` | `ClipBinder.target(name)` |
| `interpolate` | `interpolate: 'oklab'` | `ClipBinder.interpolate[name]` |
| a function `weight` | `weight: 'fade'` | `ClipBinder.weight(name)` |
| `axes`, by name or by index | `axes: ['armL', 'foreL']` | nothing: the track's target answers its own names |
| an event's `fire` and `book` | `name`, with `data` | `ClipBinder.event(name, data)` |
| a function easing | its built-in name, or `{ bezier }` | nothing: both are data |
| a typed array in a key's value, as a `Path` has | `{ __ta: 'f32', data: [...] }` | nothing: `bindClip` reads it back |

`bindClip(clip, binder)` answers what `animator.timeline` takes, and `toClip` reads a
live timeline back, an edited one included, because a live track keeps its names
(`targetName`, `interpolateName`, `weightName`, an event's `name`). `sceneClipTargets(scene, { rigs })`
is the binder's `target` for a scene: `pose:<node id>` and `rig:<name>`. A track over
part of a rig names joints as its `axes`, so it holds the same joints after the skeleton's order
changes. A target whose axes have no names takes `axes` as numbers. A track that
moves something else gets a target of its own from `createTarget`; a clip holds no
`onTick`.

## Rig and skin

A **rig** is a `Skeleton`, joints in a parent chain, bound to scene nodes by
`bindRig` or `useRig`. Its pose is one animation target, `rig.target`, and each
frame it writes what that target shows through pose overrides. It moves nodes in
two ways:

| Option | What follows a joint | What the rig writes |
|---|---|---|
| `bindings` | A whole node, rigidly | The override's `pose` |
| `skins` | Each point of a path, by weight | The override's `path`, and its `pose` as that path's bounds |

A **skin** is one weight array per joint name, indexed by point: every coordinate
pair of the path's `coords`, curve handles included. Each point goes where each of
its joints' motions since the bind pose would carry it, averaged by weight
(`skinPath`, in `@weasel-js/animator` with the rest of the scene-free rig code), so one outline flexes at a joint where bound nodes hinge. The fill,
the stroke, picking, and the selection box all read the bent path, and so does a
node that derives from the skinned one, as its dependency's `path`. `autoSkin`
makes a skin from each point's distance to the bones; a joint with no child gets
no weight, so a limb needs an end joint.

A rig can also live in the scene. A node holds the skeleton in `data.skeleton`,
its joints relative to that node's box, and the nodes under it hold `data.skin`
or name a `data.joint` to ride whole. `useRigNode` binds from those and binds
again when they change, keeping its target and what is animating it. When the
joints themselves change it has a new target, which shows what was animating the
old one on every joint both name, and `useBoneTool` and `useWeightTool` edit them on the
canvas, one scene op per edit.

The blend runs on the CPU over the path's own points, and the renderer is handed a
new path each frame the rig moves. It is not done on the tessellated mesh or in a
vertex shader, because a stroke is a ribbon rebuilt from the path and picking reads
a path, so this is the route where everything a node shows agrees.
The blend itself is about 1% of the cost and tessellation is the rest:
measured in Node on a closed loop of cubic segments with a 3px round-joined
stroke, 24 anchors cost 0.13 µs to blend, 7.9 µs to tessellate the fill, and 18.1 µs
to rebuild the stroke, and 200 anchors cost 1.03, 71.0, and 72.2.

Before relying on it:

- The rest path is read when the rig is bound, and the tools edit the rig as it
  rests.
- A container clips its children to its box unless `clipFromPose` says otherwise,
  so a rig node whose paths bend past its box sets `clipFromPose: () => null`.
- Editing a skinned path's points keeps its weights with them: the anchor edit actions and
  the pen write `data.skin` in the same undo entry as the path. A new point takes weights
  between those of the anchors either side of it, by its distance to each, and a point drawn
  past an end takes the end's. `editAnchorSetTracked` answers where each point of an edited
  path came from and `remapSkin` applies that to a skin, for an edit made some other way.

## Descriptor

`PoseDescriptor<TPose>` projects an arbitrary `TPose` onto the kit's
rect-driven machinery:

- `getBounds(pose) → { x, y, width, height }` — AABB.
- `remapBounds(pose, src, dst) → pose` — affine remap on resize.
- `translate(pose, dx, dy)` — optional, used by move and snap.

`RECT_POSE_DESCRIPTOR` is the identity for rect poses; `pathPoseDescriptor`
is the implementation for `Path`. `<SceneCanvas geometry={{ pickEvery,
boundsOf }}>` overrides hit-testing and bounds; `UseResizeOptions.geometry`
carries the descriptor itself. See [extending.md](./extending.md).

## Op

An **op** is an invertible mutation:

```ts
interface Op {
  apply(adapter: unknown): void;
  invert(): Op;
  label?: string;
  coalesceKey?: string;
}
```

Constructors live under `packages/core/src/core/ops/`: `createTransformOp`,
`createInsertOp`, `createDeleteOp`, `createSetSelectionOp`,
`createReorderOp`, etc. Every gesture and action hook produces ops on
commit; `dispatchApplyBatch(adapter, ops, label)` calls
`adapter.applyBatch?.(ops, label)` if available, otherwise applies each op
directly against the adapter.

**Transient** ops apply via `adapter.applyOps(ops)` — no history entry.
Selection-only changes (e.g. marquee result) are transient by default.

## Ongoing handle

An action with `invoker.timing: 'ongoing'` opens a gesture: `start(ctx)`
returns an **`OngoingHandle`** that the dispatcher pumps with `onMove` and
closes exactly once via `onEnd(ctx, 'commit' | 'cancel')`. The handle is
stateful but pure — it doesn't touch the DOM. It exposes its in-flight visuals
through optional methods the canvas reads each frame:

```ts
interface OngoingHandle {
  kind?: string;                      // 'move' | 'marquee' | 'lasso' | … for chrome rules
  onMove?(ctx): void;
  onEnd?(ctx, reason: 'commit' | 'cancel'): void;
  previewIds?(): Iterable<string> | null;   // displaced nodes → preview-ghost layer
  previewPose?(id): unknown | null;
  previewData?(id): unknown | null;         // for data-space edits (anchor drag)
  previewHidesSource?: boolean;             // false for clone: original stays put
  overlay?(): OngoingOverlay | null;        // non-ghost chrome (marquee rect, lasso polyline)
}
```

`previewIds` / `previewPose` / `previewData` feed `usePreviewGhostLayer`, which
assembles a synthetic node per id and draws it through the scene slot.
`overlay()` feeds `useDispatcherOverlayLayer` for gestures that displace
nothing but still need feedback. Sources compose first-non-null per axis.
`getActiveAction().kind` is how chrome-visibility rules ask what's in flight.

## Layer

A `RenderLayer<TData>` is a named draw function. The `layers` prop on
`<Canvas>` is a map of slot name → config:

- **Standard slots** (canonical order): `grid`, `cellHighlight`, `scene`,
  `selectionOverlay`. Pass slot config (`{ drawOne, ... }` for `scene`,
  `{ spacing, bounds }` for `grid`, etc.) or `null` to suppress.
- **Custom layers**: any other key. Value is `{ layer, after?, before? }`
  with a `RenderLayer` and an optional anchor slot for ordering.

```ts
layers={{
  scene: { drawOne: (cx, obj, pose) => { /* ... */ } },
  hud: { layer: hudLayer, after: 'selectionOverlay' },
}}
```

See [extending.md](./extending.md) for custom-layer details.

**Hit-test channel.** Layers may declare an optional `hitTest(worldX, worldY, data, view, dims): AffordanceBinding | null`, consulted on pointerdown. Registered layers are walked top-down (last-registered first) by `CanvasExtensionApi.hitTestExtras`; `<SceneCanvas>` folds that walk — plus its own selection chrome — into the `affordanceAt` thunk it hands the gesture dispatcher. A hit reaches actions as an `AffordanceHit` (kind `layer:<id>` for a registered layer, carrying whatever the layer resolved as its `payload`), and the layer's owner claims the gesture with a binding whose `target` predicate matches that kind. This is how chrome stays hittable regardless of which tool is active — see `@weasel-js/hud` for the worked example.

**Command caching.** A layer may declare `deps?: (data, view, dims) => readonly unknown[]`. When a `LayerCommandCache` is supplied to `drawLayers` (Canvas owns one), a layer whose deps come back `Object.is`-equal to the previous call reuses its previous `DrawCommand[]` instead of calling `draw` again. A layer without `deps` rebuilds every frame. This skips rebuilding the command tree, not GPU dispatch — every layer is still submitted to the renderer each frame regardless of caching.

Returned command trees must be treated as immutable: a cached tree is handed to the renderer again on later frames, so mutating one you previously returned corrupts the cache silently rather than erroring. World-space layers are protected against a stale `view` — `drawLayers` computes the `viewToMat3(view)` group wrap fresh outside the cache — but screen-space (`space: 'screen'`) layers are not; if `draw` reads `view` or `dims`, include them in `deps`. And an `id` must name the same logical layer across frames, since the cache is keyed on it.

## Affordance

A reusable factory primitive that produces a `{ render, hitTest? }` triple. Tools that own chrome (selection handles, rotation handle, anchor dots) compose affordances rather than reimplementing the render + hit-test logic inline. The kit ships `createCornerResizeAffordance` and `createRotationAffordance`; both read state from a kit-built `ChromeState` object so the affordance code stays pure (no React, no scene access).

**Visible chrome is hittable independent of the active tool.** The hit-test walk runs once per pointerdown and the result rides the gesture as `InvocationCtx.drag.affordance`; a corner-handle drag fires the resize action even when a non-select tool is active. A hit is a claim, and a claim of `strength: 'exclusive'` bars every binding whose target doesn't consult the affordance — so chrome is never mistaken for a body pick and the gesture reaches whatever owns it, without each tool having to decline chrome by hand.

## Interaction

Everything the user does to the scene is an **interaction**. The kit splits
interactions into two kinds:

- **Gestures** — pointer-driven, with a start/move/end lifecycle. They live
  under `packages/core/src/interactions/gestures/`.
- **Actions** — discrete, one-shot mutations that don't have a drag phase.
  They live under `packages/core/src/interactions/actions/`. Most are keybinding-driven
  (Esc, Cmd+A, Cmd+D, arrows, Cmd+Z), but they're really just functions
  that produce ops; the keybinding wiring is optional.

Same adapter, same op pipeline, same undo history. The split is about
*how the input arrives*, not about what the code can do.

## Gesture

A **gesture** is a form of input: a click, a drag, a wheel turn, a keystroke,
a pinch, a hover. It says how input arrives and nothing about what happens
next. Move, resize, rotate, insert, area-select, clone, and edit-anchors are
[actions](#action); a binding pairs one with the gesture that drives it, and
the pair is an [interaction](#interaction). [taxonomy.md](./taxonomy.md#gesture)
lists every gesture kind.

An action a drag drives is *ongoing*: it has a start, a move per frame, and an
end or a cancel.

A **behavior** is a small composable extension to an ongoing action that
refines the in-flight pose and/or supplies commit ops:

```ts
interface ActionBehavior<TPose, TProposed, TMoveResult> {
  defaultTransient?: boolean;
  onStart?(ctx): void;
  onMove?(ctx, proposed): TMoveResult | void;
  onEnd?(ctx, end): Op[] | null | void;
  onCancel?(ctx): void;
  onSettled?(ctx, committed): void;
}
```

Behaviors run in array order; later ones see refinements from earlier ones.
`onEnd` returns: `Op[]` to commit, `null` to abort, `undefined` to fall
through. `onCancel` runs in its place on a canceled gesture, and `onSettled`
runs after either, once the document holds the result. `ctx.scratch` is per-gesture mutable state. `defaultTransient`
makes a move, resize or rotate commit without a history entry unless
`transient` is set explicitly. See [extending.md](./extending.md) for writing one.

Built-in behaviors: `snap(strategy)`, `snapToContainer(...)`,
`snapBackOrDelete(...)` for move; `clampMinSize` and `lockAspectWithModifier`
for resize; `snapRotationWithModifier` for rotate, which a rotate applies with
Shift and 15 degree steps unless its binding is given a `behaviors` list. A clone drag takes the move behaviors that only reshape the
translation (`snap(strategy)`), as `CloneBehavior`. Grid and guide snapping —
`snapToGrid`, `snapToGuides`, `gridSnapStrategy`, the alignment behaviors —
are in `@weasel-js/guides`. Marquee area-select is unconditional — it is
`areaSelectAction`'s built-in behavior, not an opt-in one.

## Action

An **action** is a unit of user intent — delete, move, undo, align — declared
as a static descriptor and registered into the Actions Registry. Actions are
not hooks. A descriptor says what it does (`invoker.run`), what state it needs
(`requires`, resolved from the dep registry at dispatch time), when it's
allowed (`eligible` / `enabled`), and how it's reached by default
(`defaultBinding`):

```ts
export const deleteAction: Action & { requires: string[] } = {
  id: 'delete',
  label: 'Delete',
  defaultBinding: {
    kind: 'key',
    key: ['Delete', 'Backspace'],
    phase: [{ channel: '*', phase: 'initial' }],
  },
  eligible: { capability: 'edits-page' },
  requires: ['scene', 'selection', 'applyOps'],
  invoker: { timing: 'immediate', run: (deps) => { /* … */ } },
};
```

`useStandardActions` registers the kit-standard set into the surrounding
`<ActionsProvider>`; `<SceneCanvas>` calls it for you, leaving out whatever
its `features` presets and tools do not name. Actions reached by a
pointer gesture (`move`, `resize`, `insert`, …) are the same kind of object —
an `invoker` with `start` / `move` / `end` rather than a one-shot `run`. A
tool is just an array of `{ spec, actionId }` bindings pointing at them.

Imperative callers — a toolbar button, a command palette — use
`registry.trigger(id, params)`, which resolves deps exactly as a gesture
would, so there is one commit path and undo/coalescing behave identically. See
[hooks.md](./hooks.md) for the full action table and default keybindings.

### Keyboard activations are actions

Tool-switch shortcuts (`V` → Select) and held-key activations (Space → Hand)
are registered as actions in the actions registry, not as fields on
`ToolDef`. The factories in `packages/core/src/interactions/actions/defaults/` produce
them:

- `makeToolActivateAction(bindings)` — single parametric action registered
  under id `tool.activate`. Its `defaultBinding` is a `BoundGesture[]` with
  one entry per tool; each entry carries `opts.params.toolId`. The invoker
  reads `params.toolId` and calls `activeTool.setActive(toolId)`. Imperative
  callers (palette, toolbar) reach the same effect via
  `registry.trigger('tool.activate', { toolId })`. Build entries with
  `buildToolActivateBindings(specs)`.
- `makeToolOffhandAction(bindings)` — single parametric action registered
  under id `tool.offhand` for hold-to-engage hotkeys (e.g. Space-for-hand).
  `defaultBinding` is a `BoundGesture[]` of `key-held` specs, each carrying
  `opts.params.toolId`. On `start` the invoker pushes the tool id onto the
  active-tool context's hotkey stack; `onEnd` pops it. The dispatcher's
  `inFlightOwners` machinery advances the channel through the same
  `[initial]` → `[engaged]` → `[initial]` lifecycle that drag uses. Build
  entries with `buildToolOffhandBindings(specs)`.

A tool's activation key is the `keybinding` on its `ToolDef`, the built-in tools'
included; `useKeybindings` (`packages/core/src/tools/useKeybindings.ts`) appends an
entry for each to the consolidated `tool.activate` action's bindings. Held-key
engagement is not wired there: a tool declares `hotkey` on its `ToolDef` — `'space'`, a modifier, or
any other key such as `'o'` — that becomes `eligibility.offhand`, and assembly
registers the consolidated `tool.offhand` action from the declaration. A tool
that is only ever held sets `presentation.hide` to stay off the palette.

A `key-held` binding is an edge — a press opens an invocation, the release
closes it — and a key only reaches it if the binding wins the route. A game loop
asking "is Left down this step?" wants neither: `useKeyState()` /
`createKeyState()` poll which physical keys (`KeyboardEvent.code`) are down,
whatever the bindings claim, and `take(code)` hands out each fresh press once.

### Hover cursors predict the drag route

While no gesture is in flight, the dispatcher's hover-cursor pump (in
`useGestureDispatcher`) resolves what the pointer is over on every
pointermove and writes a cursor override to the canvas. Precedence:

1. **Affordance hits** — `buildAffordanceAt` stamps `AffordanceHit.cursor`
   on its hits (resize corners → `nwse/nesw-resize`, rotate ring → `grab`);
   a declared cursor wins outright.
2. **Predicted action** — otherwise the pump asks
   `Dispatcher.resolveOnly(...)` which action a drag starting here would
   route to (the same specificity-sorted, `enabled()`-gated walk a real
   pointerdown takes) and applies that action's optional `Action.cursor`.
   E.g. `viewport.dragPan` declares `cursor: 'grab'`, so empty canvas shows
   the open hand whenever pan would actually win the drag — including when
   a higher-specificity marquee binding falls through because its deps
   aren't wired.
3. **Tool base** — no override; the active tool's `Tool.cursor` shows. The
   canvas's cursor sink (`CanvasExtensionApi.cursorSink`) holds both and is the
   one writer of the element's `cursor` style, so clearing an override puts
   the tool's cursor back.

Give a consumer action a hover hint by declaring `cursor` on its
descriptor — no pump wiring needed. Because prediction runs `enabled()`
but cannot run the invoker, keep `enabled` truthful for actions that
declare a cursor: an action that matches but bails inside `start()` (the
empty-handle pattern) will still show its cursor.

Modifier and hotkey changes (e.g. holding Space to engage the hand tool)
re-run the prediction at the last hover position, so the cursor re-routes
without pointer movement.

Inspector surfaces (the ToolPalette's shortcut chips, the HotkeyTrigger
detail view) read from the action registry — there is no per-tool
keybinding field driving them. The `keyHeld` gesture has a first-class
descriptor in the route grammar (alongside `keyDown` / `keyUp`), so route
strings like `[*:initial] keyHeld(Space)` parse, format, and render in
the inspector exactly like other gestures.

## Selection mode

Click policy belongs to the selection, not the canvas:
`useSelection({ mode })`, or `<SceneCanvas selectionOptions={{ mode }}>` for
the selection the canvas builds when it is not handed one.

- `single` (default): a click replaces the selection with the clicked node,
  modifiers or not. It is a click rule, not a cap — a marquee, lasso,
  select-all or paste can still select several nodes.
- `multi`: a click with the extend key (`extend`, shift by default) toggles
  the node in or out of the selection.

Several selected nodes draw one union box whose corner handles resize the set,
whichever mode made the selection.

`<SceneCanvas selectable={false}>` is the canvas's own switch: nothing the
canvas does writes the selection — no click, marquee, lasso, action or tool.
The consumer's `SelectionApi` still writes, and the canvas draws what it holds.

## Picking

A click resolves against a node's **inked region**, not its pose box —
`<SceneCanvas geometry={{ picking: 'shape' }}>` is the default, and `'pose'`
is the opt-out. `shapeCoversPoint` (`canvas/NodeShape.ts`) takes a pose-rect
hit and refines it with the painter's `findShapeSilhouette` +
`pathContainsPoint`, so the counter of a donut, the gap between the arms of a
compound path, and the empty middle of a U all fall through to whatever is
behind them. A painter with no silhouette keeps the AABB answer, so the
refinement can only ever tighten a pick.

Whether the fill counts at all comes from `NodeShapeEntry.ink(node, pose)`,
which returns `{ filled, outset, inset }` off cheap node fields — deliberately
*not* read back off `paint`, which may lay out glyphs on every pointer move.
`outset` and `inset` are how far the ink reaches either side of the outline,
which is per-side because a stroke's `align` decides which side it lands on.
The fill test only runs when the painter fills; either way `shapeCoversPoint`
ORs in `strokeHitTest` at that side's reach plus `tolerance`, so an outlined
rect is grabbable by its outline and a bare line — zero area, unpickable by
any fill test — is grabbable along its length. `tolerance` is
`geometry.pickTolerancePx` (screen px, default 4, converted against the live
view), because a hairline is a sub-world-unit target no pointing device can
hit; the pose-rect pre-filter grows by the same amount or it would reject
outline hits before the refinement ran.

Off the `SceneCanvas` path, `useSelectTool({ leafPicking, pickTolerance })`
is the same behavior with a world-unit tolerance. Both scene pick paths agree.

## Tool

A tool is a list of `{ spec, actionId }` bindings that are live while it holds
the active slot, or while its `hotkey` is held. With the select tool active an
empty-space drag marquees; with a shape tool active it inserts. A canvas can
also have no active tool at all — `useTools({ registry })` with no `active` —
and run on ambient bindings alone.

## Putting it together

```tsx
import { SceneCanvas, useScene } from '@weasel-js/core';
import { createGridLayer } from '@weasel-js/guides';

type Swatch = { color: string };

const GRID = createGridLayer({ spacing: 20, bounds: () => ({ x: 0, y: 0, width: W, height: H }) });

function Editor() {
  const scene = useScene<Swatch, 'default'>({
    systemLayers: [{ id: 'default' }],
    initial: [
      { kind: 'leaf', layer: 'default', pose: { x: 40, y: 40, width: 70, height: 50 }, data: { color: '#7fb069' } },
    ],
  });

  // No per-action wiring: move, resize, rotate, `transformAgain` (Cmd+D), and
  // `delete` (Backspace/Delete) are registered by the features named here.
  return (
    <SceneCanvas
      width={W} height={H}
      scene={scene}
      features={['draw']}
      selectionOptions={{ mode: 'multi' }}
      layers={{
        scene: {
          drawOne: (node, pose) => [
            { kind: 'path', path: { kind: 'rect', ...pose }, fill: { paint: { color: node.data.color } } },
          ],
        },
        grid: { layer: GRID },
      }}
    />
  );
}
```

The scene slot's `drawOne` returns draw commands for one node at its pose; it
does not draw into a 2D context. Leave the slot out and the canvas paints each
node from its `data` with `defaultDrawOne`.

## System registries

The kit maintains several **registry** data structures — keyed lookups that map string identifiers to kit-managed objects like fonts, tools, ops, and shader programs. Each registry has a distinct scope, lifecycle, and mutability story.

| Registry | Keyed by | Scope | Mutability | Where it lives | Reflection | Used by |
|---|---|---|---|---|---|---|
| **Fonts** | `family` → `weight\|style` | App (module) lifetime | Runtime-mutable; entries are idempotent | Module-global reflectable in `registerFont.ts` | `fontRegistry`; `listFonts()`; `listFontWeights(family)` | `WeaselRenderer`, text layout |
| **Font outlines** | `family\|weight\|style` | App (module) lifetime | Runtime-mutable; register / unregister | Module-global reflectable in `outline/outlineRegistry.ts` | `fontOutlineRegistry` (notifies on load-state changes too); `listFontOutlines()` | `paintRuns` (above the size threshold) |
| **Tools** | Tool id string | Component lifetime, pinned at `useTools` call | Constructor-fixed (registry reference is live, but entries are set at hook call) | Hook return (`ToolsApi.registry`) in `packages/routing/src/tools/useTools.ts` | Implicitly — `registry` field is enumerable | Gesture dispatcher, tool palette UI |
| **Ops** | Op kind string (`kit:*` reserved) | Scene lifetime | Constructor-fixed via `ops` option; runtime additions via `scene.registerOp()` | Internal `Map` inside `createScene` closure | No | `Scene.undo()`, `Scene.redo()`, `scene.recordOp()` |
| **Op factories** | Op name string | App (module) lifetime | Runtime-mutable; newest replaces | Module-global reflectable in `core/ops/registry.ts` | `opFactoryRegistry`; `registeredOpNames()` | `History.restore()` rebuilding serialized ops |
| **Scene function fields** | Registry key string | Scene lifetime | Constructor-fixed | `SceneRegistry` option on `createScene` / `sceneFromJSON` | No | `scene.toJSON()`, `sceneFromJSON()` serialization round-trip |
| **Actions** | Action id string | Provider lifetime | Runtime-mutable; registrants stack per id, per scope | Input-scope tree in `packages/routing/src/interactions/actions/ActionsProvider.tsx` | `registry.list()` + `subscribe()` | Command palette, keybinding dispatch |
| **Modes** | Mode id string | Registry lifetime | Constructor-fixed set; the active mode changes | `createModeRegistry` in `packages/modes/src/registry.ts` | `ModeRegistry.reflection` | Mode gating, `ToolPalette` |
| **Easings** | Easing name string | Module lifetime | Frozen (compile-time constant) | Named export `EASINGS` in `easings.ts` | Implicitly — plain object, enumerable by key | `useAnimator`, animation hooks |
| **Shader programs (source)** | Program id string | Module lifetime | Runtime-mutable; dev-mode allows replacement, prod throws on duplicate | Module-global reflectable in `registerProgram.ts` | `programSourceRegistry` | `WeaselRenderer.registerProgram()` |
| **Shader programs (compiled)** | Program id string | Renderer lifetime | Runtime-mutable; rebuilt on GL context restore | `Map` on each `WeaselRenderer` instance | No | `draw.ts` dispatch, `kind: 'shader'` draw commands |
| **Paint kinds** | `Paint` discriminant | App (module) lifetime | Runtime-mutable; `registerPaintKind` returns a disposer; overrides stack; a kind with a loader registers on first lookup | Module-global reflectable in `core/paint/paintKinds.ts` | `paintKindRegistry`; `listPaintKinds()`, `listGradientKinds()`; `usePaintKinds()`, `useGradientKinds()`, `usePaintKind(id)` in React | `draw.ts` fill dispatch, `fillInPoseFrame`, `<defs>` emit, `PaintInput`'s and `GradientEditor`'s kind bars, `switchGradientKind` |
| **Stroke markers** | Marker id string | App (module) lifetime | Runtime-mutable; `registerMarker` returns a disposer; overrides stack | Module-global reflectable in `@weasel-js/stroke` | `markerRegistry`; `listMarkers()` | Stroke end-cap drawing, `markerCommandCache` |
| **Textures** | Auto-assigned `tex_N` id | App (module) lifetime | Runtime-mutable; append-only, no unregister in v1 | Module-global reflectable in `registerTexture.ts` | `textureRegistry` | `GLTextureCache`, `kind: 'shader'` uniform binding |
| **Canvas layers** | Slot name string | Component lifetime, fixed at render | Constructor-fixed (prop value at render time) | `LayersMap` prop on `<Canvas>` / `<SceneCanvas>` | Implicitly — `Object.entries` over the prop | `<Canvas>` layer compositor |
| **Object-kind classifier** | Target kind string | — | — | — | — | Shipped as the routing trait: `createNodeRouting` and `NodeRoutingEntry` |

**Fonts** (`packages/font/src/registerFont.ts`) use a two-level Map — outer key is the font family, inner key is `weight|style` — so `resolveFontVariant` can walk the fallback chain within a family without scanning everything. Idempotent: re-registering an existing variant is a no-op.

**Font outlines** (`packages/font/src/outline/outlineRegistry.ts`) are a *third glyph tier*, not a fourth font registry: they never resolve a family on their own, they only replace how an already-resolved glyph is painted. Above `OUTLINE_MIN_SCREEN_PX` on-screen pixels, a face with registered outlines renders as tessellated geometry — exact at any zoom, and an ordinary path, so it takes gradient and pattern fills. Deliberately a flat `family|weight|style` map with **no** fallback chain: substituting a nearby variant would paint the wrong weight at the right advances, which looks worse than the distance field it replaced, so a miss declines and falls back down the tier ladder (outlines → canvas SDF → baked atlas) instead.

The ladder's ordering rule: **each tier answers only "can I paint this glyph, right now?"** Loading is asynchronous everywhere (`fetch` for a URL, `queryLocalFonts` behind a permission for machine faces), so a tier that cannot answer yet answers `null` and the next one draws. `subscribeGlyphReady` (`packages/font/src/glyphReady.ts`) is the shared signal that a later frame can do better — both the deferred SDF bakes and the outline loads fire it, and `<SceneCanvas>` subscribes once.

**Tools** (`packages/routing/src/tools/useTools.ts`) — the `registry` prop passed to `useTools` is held in a ref so new object references re-read cleanly each render. Tools not in `registry` can still appear in the `ambient` array (always-on tools); `ToolsApi.has(id)` checks both.

**Ops** (`packages/core/src/core/scene/scene.ts`) — the internal `registered` Map is seeded with the kit's own `kit:*` ops at construction time, then consumer ops from `UseSceneOptions.ops`, then any later `scene.registerOp()` calls. `kit:*` kind strings are reserved; consumer ops that try to use the prefix throw at registration time.

**Scene function fields** (`SceneRegistry` in `packages/core/src/core/scene/types.ts`) — a separate registry from ops. Its sole purpose is serialization: `clipFromPose` is a function and can't travel through JSON, so `scene.toJSON()` replaces it with a string key and `sceneFromJSON()` restores the function from the registry. Reserved for future non-serializable node fields.

**Actions** (`packages/routing/src/interactions/actions/ActionsProvider.tsx`) — the only registry backed by React context. Entries are owned by components (registered in `useEffect`, cleaned up on unmount). `register()` returns its own release; registrants for one id stack, newest live, so hot-module replacement doesn't orphan stale entries.

**Easings** (`packages/geom/src/easings.ts`, re-exported by core) — not a registry in the dynamic sense; `EASINGS` is a frozen `as const` object. `SPRING_PRESETS` follows the same shape for the four named spring curves.

**Shader programs** split across two levels. The module-level source registry (`registerProgram.ts`) is GL-context-agnostic and shared across all renderers. Each `WeaselRenderer` instance maintains its own compiled-program registry (`programRegistry`), rebuilt from source on GL context restore. This mirrors the font registry pattern: fonts store `ImageBitmap` at module scope; each renderer's `GLTextureCache` handles the per-context upload.

**Paint kinds** (`packages/core/src/core/paint/paintKinds.ts`) are what make `Paint` open: a registered kind draws, converts between the bounds and pose frames, and serializes with no kit edits. The entry is one object, but its slots are consumed in three places — the renderer keeps its own registry (`renderer/paintKinds.ts`) of the draw slots alone, and `registerPaintKind` hands every entry to it — so each layer consults the registry for a kind it does not recognize and otherwise runs its own branch — a built-in kind's render slot lives in the GL renderer and its serialize slot in `@weasel-js/svg`, neither importable from core without inverting a package dependency.

A kind can also load on demand. `registerPaintKindLoader(id, load)` declares one whose code stays out of the bundle until something looks it up: the first `getPaintKind` miss starts `load`, which resolves with the entry, and the registry registers it. Until then the kind is unknown everywhere — the renderer draws nothing for its fills — and the registration's change notice is what `<SceneCanvas>` repaints on, the same way a late image or glyph repaints it. `mesh-gradient` is the kit's own lazily loaded kind; importing anything from `@weasel-js/core/mesh` registers it synchronously instead. A lazily loaded module must import nothing from core that the root barrel also reaches: esbuild with code splitting loads every module a dynamic chunk shares with an entry's graph along with that entry, so core's build rebuilds each such module as one self-contained file (`LAZY_KINDS` in `packages/core/vite.config.ts`), and `npm run check:treeshake` bundles with both esbuild and rolldown. `warmPaintKinds(kinds?)` loads ahead of the first frame, and a synchronous path that cannot wait for a load — `renderSceneToPixels`, `serializeSvg` — needs it awaited first. A headless render also draws no text from a font atlas still loading, so it awaits `warmRender({ render: args })`, which builds the render's commands the way the render will, reads off them the faces and paint kinds they draw with (`renderNeeds`), and loads only those — an unrelated font that fails to load cannot fail the capture.

`Paint` itself stays a closed union — opening its discriminant would widen every built-in member and break the narrowing the kit's own branches depend on — so a registered kind declares its own interface and passes it through `asPaint`. The render slot is `bind` rather than `draw` because a caller owning its own stencil state (an inner/outer-aligned stroke, an even-odd fill) has to issue its own draw call. A kind's shader goes through the ordinary `registerProgram` source registry — declared on the entry as `programs`, which registering the kind registers — and compiles into each renderer on first use, so a kind registered after a renderer exists still paints.

**Textures** (`packages/renderer/src/textures/registerTexture.ts`) — entries are keyed by auto-assigned opaque ids (`tex_N`), not caller-chosen names, so collision is impossible. The `TextureHandle` returned by `registerTexture()` is what callers pass as a `ShaderUniform` value. No unregister in v1; texture lifetime is the app lifetime.

**Canvas layers** — the `LayersMap` prop is not a traditional registry but fits the pattern: it maps string slot names to layer configs, the compositor enumerates them at render time, and custom entries declare ordering via `before?` / `after?` anchors. Scope is per-`<Canvas>` instance; the map is treated as immutable for a given render pass.

The kit deliberately does not unify these into one shape. The lifecycles differ enough — module-global vs. scene-scoped vs. React-context vs. component-prop — that a single registry abstraction would either over-constrain the complex cases (fonts' variant fallback, ops' `kit:*` reservation) or bloat the simple ones (easings, spring presets).

What they do share is the reflection concern: enumerating entries for a debug overlay, and noticing when two registrants claimed one key. That part is `createReflectable<V>()` (`@weasel-js/registry`, re-exported from core): a keyed store a registry embeds and writes through, which hands out a read-only `Reflection` — `get`, `has`, `entries()`, `subscribe`, `getVersion`. `entries()` returns the same frozen array until the next change, so the whole surface drops straight into `useSyncExternalStore`. Each entry carries the live value, the registrant's `source` when it named one (built-ins register as `'kit'`), and `shadowed` — the registrants it displaced, oldest first, which is the conflict report. Each registrant is one frozen object for as long as it is registered, the live one reported as the entry's `live`, so the owner can remove any one of them with `release(key, registrant)`. Two write verbs: `push` stacks and returns a release that uncovers what it displaced (paint kinds, markers), and `set` replaces in place like `Map.set` (fonts, programs, op factories, modes). Validation, lookup fallbacks and lifecycle stay in the registry.

Registries that don't embed it, and why:

- **Tools**, **Canvas layers** — a prop read at render; the caller already holds the whole map.
- **Ops**, **Scene function fields** — per-scene options objects with no runtime enumeration need beyond the scene itself.
- **Actions** — a scope tree: one id resolves differently per scope, and `mute` hides an entry without removing it, so "the entries" has no single answer.
- **Shader programs (compiled)** — a per-renderer cache of GL objects, rebuilt from the source registry, which is the one reflected.
- **Easings** — a frozen constant.
- **Canvas fonts** (`listCanvasFonts`) — whether a family is served depends on the fallback policy in force, so the list is computed, not stored.
- **Node shapes**, **content handlers** — priority-ordered predicate lists, not keyed lookups; two painters matching one node is ordering, not a conflict.
- **Quantity display kinds** — kept a static built-in table so `@weasel-js/quantity` stays free of module side effects.
