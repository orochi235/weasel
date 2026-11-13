# @weasel-js/kernel3d

Poses, an orbit camera, ray picking and screen-projected chrome geometry for
weasel, over `@weasel-js/core`'s scene graph and dispatcher.

**It hosts a renderer rather than owning one.** A consumer brings its own — a
bespoke WebGL pass, three.js, anything — and the kernel hands it poses. The one
thing here that touches WebGL is the line pass (below), which that renderer
calls into its own context.

```ts
import { createScene } from '@weasel-js/core';
import {
  POSE3_COMPOSITION, createCamera, createNodeAtPoint, createPoseDescriptor, pose3, type Pose3,
} from '@weasel-js/kernel3d';

const scene = createScene<MyData, 'solids', Pose3>({
  composition: POSE3_COMPOSITION,
  systemLayers: [{ id: 'solids' }],
});
const world = { scene, viewport: () => ({ camera, width, height }) };

// Every dep takes its camera from a thunk. That is the whole trick: the
// dispatcher keeps handing actions two numbers, and the camera each dep closes
// over is what makes them a ray.
const nodeAtPoint = createNodeAtPoint(world);
const poseDescriptor = createPoseDescriptor(world);
```

## On a `<SceneCanvas>`

The deps go where the canvas reads them: `poseDescriptor` and `geometry.pickEvery` as props, and the
camera, the insert and the snap as one ambient entry's deps. `features={['pick', 'move']}` turns on
the select tool's click and drag; the layers are yours to draw.

```tsx
const insert = createInsert({
  world,
  // The dep mints the id and commits the node as one undo step.
  node: ({ center, width, depth }) => ({ data: { color: 'tan' }, pose: pose3({ ...center, y: 0.5 }, { x: width, y: 1, z: depth }) }),
});
const rig: SurfaceContribution = {
  id: 'rig',
  eligibility: { always: true },
  actions: [orbitAction, panAction, dollyAction],
  deps: {
    camera3d: () => ({ get: () => cameraRef.current, set: setCamera, size: () => size }),
    insert: () => insert,
    snap: () => createSnap(world, { sources: [groundGridSource({ world, step: 1 })] }),
  },
};

<SceneCanvas
  scene={scene}
  features={['pick', 'move']}
  tools={{ orbit: useOrbitTool(), box }} // `box` binds a drag to `insert`
  ambient={[rig]}
  poseDescriptor={createPoseDescriptor(world)}
  geometry={{ pickEvery: createPickEvery(world) }}
  layers={{ scene: { drawOne: () => [] }, solids: { layer: mySolidsLayer, before: 'scene' } }}
/>
```

A world with another up (`up: { x: 0, y: 0, z: 1 }`) passes it to everything that places the
camera: `World3d.up`, `Camera3dDep.up`, and `cameraViewProjection`, `cameraEye` and `projectPoint` in
the renderer.

## What core did not have to change

`Scene` is generic over its pose and holds a `Pose3` — position, quaternion,
scale — with no adapter and no special case. `InvocationCtx` still carries two
numbers: a 3D host passes the dispatcher an identity `clientToWorld`, so
`ctx.world` is the screen point, and each dep rebuilds the ray itself. Tools,
the select tool included, transfer untouched.

One thing does not:

- **`ViewApi` has no orientation**, so an orbit camera cannot travel through
  the kit's `view`. The kernel declares a `camera3d` dep of its own.

## The camera's actions

`camera.orbit` turns the `camera3d` dep on a drag, `camera.pan` slides its
target across the screen plane, `camera.dolly` answers the wheel and both
trackpad pinches, `camera.pinchDolly` two fingers, and `camera.home` returns it
to the dep's `home()`. Both dollies go through `dollyToward`, which keeps the
point in the target's plane under the pointer still, as a 2D wheel zoom does,
measured against the dep's `size()`. Each holds the camera inside the dep's `limits()` — an
`OrbitLimits` in the scene's own units, defaulting to `DEFAULT_ORBIT_LIMITS` —
through `clampCamera`, which `orbitBy` and `dollyBy` take as well. labkit's
`orbit` capability is these actions on a dep the trial owns.

## The depth a screen rectangle does not name

`PoseDescriptor` reads `Bounds` as the screen box a solid covers. `getBounds`
runs that way and needs nothing else — it is what drives selection chrome
through an orbit. `remapBounds` and `fromBounds` run the other
way, and a rectangle on screen names a pose only once something says how far
away it is.

**The answer is "as far as it already was."** Both resolve the rectangle on the
plane through the pose they were handed, facing the camera, so neither changes
depth. Two consequences:

- A resize scales uniformly. The rectangle names two extents and a pose has
  three, so the factor is the geometric mean of the two it names.
- `fromBounds` returns a world-axis-aligned, unrotated box whose third extent
  is the mean of the two the rectangle gives it, and it reads `scale` as world
  extents — the unit-primitive assumption `aabbOfPose` makes by default.

## Containers

`POSE3_COMPOSITION` stores a child's pose in its container's frame: moving,
turning or scaling a container carries everything under it. It is exact when a
container's scale is uniform; under a non-uniform one a turned child keeps its
own axes rather than shearing, which a `Pose3` cannot hold.

Every world read folds a node's pose up through its containers first: picking,
the marquee, snap targets and what a move drags. A renderer does the same with
`worldPoseOf(scene, id)`, which also honors a gesture's in-flight pose; drawing
`node.pose` draws a nested node at its container-relative position.

A `kind: 'group'` container selects as it does in 2D: a click on a nested node
selects its outermost container, a double-click enters it, and a click inside
then selects the next level in. `createNodeAtPoint` answers the solid the ray
hits and core's select tool walks up from it, so this needs nothing from the
host but `<SceneCanvas>`'s own select tool.

## The bounds seam

`World3d.bounds` is how a consumer says how big a node is. It is handed the node
at its world pose and answers a world box, or `null` for a node that occupies
nothing, which is then never picked or snapped to. The kernel's default carries
a unit cube by a mark's pose and gives a group no box; override it when a
primitive knows better, or when a container draws. A sphere is the case that
forces the seam to be shaped this way — its box is the same under every
rotation, and no transform of a local box reproduces that.

## Aims

A kernel3d viewport answers core's `ViewAim` contract, so a 2D view and a 3D
pane can mark each other. `aimOf3d(viewport, viewId)` is the `Aim3d` its camera
sees, whose extent is a `Frustum3d`: the eye and the near and far rectangles.
Outlined in a 3D space it draws its far rectangle; in a 2D one, its footprint on
the ground, the plane through the origin at right angles to the `up` option
(default +y, as `createInsert` reads it), cut off at the far plane. The 2D x and
y lie along the two axes `up` is not: x and z for a y-up world. `aimSpace3d`
makes a pane a target, unprojecting onto the same ground, and `cameraOfAim3d`
gives back the camera a dragged aim stands for — what an `AimSource`'s `setAim`
writes.

## Lines

A stroke has no mesh a renderer can draw, so the kernel ships a pass for it.
`packLines` turns polylines into vertices, and `createLinePass(gl)` draws them
into a WebGL2 context the host owns, between its own draws:

```ts
const pass = createLinePass(gl);
pass.draw(
  packLines([{ runs: [{ points }], color: [1, 0.4, 0.2, 1], width: 4, trim: { end: 0.6 }, model }]),
  cameraViewProjection(camera, width / height),
  { width, height }, // the viewport in CSS pixels
);
```

- **Widths are pixels.** Each line is widened after projection, so its shaft and
  head are the same size near the camera and far from it. Corners miter along
  the bisector, up to a limit past which a hairpin keeps a notch.
- **A trim is a `StrokeTrim`, measured in the line's own space** before `model`
  places it, through geom's length table and stroke's `resolveTrim`, as a 2D
  stroke's is. It is applied when packing, so an animated trim repacks.
- **A head caps each open run's end**: `HEAD` by default, a `HeadShape` to set
  one, `null` for none. It is capped at a share of the line's length on screen,
  and the shaft narrows by what the cap took. It stands back from the tip along
  its own segment's direction on screen, so a head longer than its segment
  stays on that segment's line. A closed subpath, or a run cut from one, has no
  head.
- **A segment with an end behind the eye is dropped**, not drawn across the
  screen.

Depth is tested against the bound buffer by default and never written; pass
`{ depthTest: false }` to draw over everything. The pass puts back the GL state
it changes. A three.js host calls it after `renderer.render`, with
`renderer.getContext()`, and then `renderer.resetState()`.

## Math

Vectors, quaternions, 4×4 matrices and ray intersection live in
`@weasel-js/geom/3d` — the same dependency-free geometry package the 2D kit is
built on. They are immutable tuples, not classes: `History.serialize()` promises
a structured-clone-safe form, and `structuredClone` keeps a class instance's
data while dropping its prototype, so a `Vector3` in a pose would return from a
reload as a bare object whose first method call throws far from the cause.

Interop with three.js is close to free anyway — `Vector3`, `Quaternion` and
`Matrix4` all carry `fromArray`/`toArray` and agree with this layout.

Direction: `docs/superpowers/specs/2026-08-22-3d-kernel-design.md`.
