# @weasel-js/kernel3d

Poses, an orbit camera, ray picking and screen-projected chrome geometry for
weasel, over `@weasel-js/core`'s scene graph and dispatcher.

**It hosts a renderer rather than owning one.** A consumer brings its own — a
bespoke WebGL pass, three.js, anything — and the kernel hands it poses. Nothing
here touches WebGL.

```ts
import { createScene } from '@weasel-js/core';
import {
  createCamera, createNodeAtPoint, createPoseDescriptor, pose3, type Pose3,
} from '@weasel-js/kernel3d';

const scene = createScene<MyData, 'solids', Pose3>({ systemLayers: [{ id: 'solids' }] });
const world = { scene, viewport: () => ({ camera, width, height }) };

// Every dep takes its camera from a thunk. That is the whole trick: the
// dispatcher keeps handing actions two numbers, and the camera each dep closes
// over is what makes them a ray.
const nodeAtPoint = createNodeAtPoint(world);
const poseDescriptor = createPoseDescriptor(world);
```

## What core did not have to change

`Scene` is generic over its pose and holds a `Pose3` — position, quaternion,
scale — with no adapter and no special case. `InvocationCtx` still carries two
numbers: a 3D host passes the dispatcher an identity `clientToWorld`, so
`ctx.world` is the screen point, and each dep rebuilds the ray itself. Tools,
the select tool included, transfer untouched.

One thing does not, and the kernel says so rather than guessing:

- **`ViewApi` has no orientation**, so an orbit camera cannot travel through
  the kit's `view`. The kernel declares a `camera3d` dep of its own.

## The depth a screen rectangle does not name

`PoseDescriptor` reads `Bounds` as the screen box a solid covers. `getBounds`
and `intersectsRect` run that way and need nothing else — they are what drive
selection chrome through an orbit. `remapBounds` and `fromBounds` run the other
way, and a rectangle on screen names a pose only once something says how far
away it is.

**The answer is "as far as it already was."** Both resolve the rectangle on the
plane through the pose they were handed, facing the camera, so neither changes
depth. Two consequences worth knowing before you build on them:

- A resize scales uniformly. The rectangle names two extents and a pose has
  three, so the factor is the geometric mean of the two it names.
- `fromBounds` returns a world-axis-aligned, unrotated box whose third extent
  is the mean of the two the rectangle gives it, and it reads `scale` as world
  extents — the unit-primitive assumption `aabbOfPose` makes by default.

## The bounds seam

`World3d.bounds` is how a consumer says how big a node is. The kernel's default
carries a unit cube by the pose; override it when a primitive knows better. A
sphere is the case that forces the seam to be shaped this way — its box is the
same under every rotation, and no transform of a local box reproduces that.

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
