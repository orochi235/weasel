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

Two things do not, and the kernel says so rather than guessing:

- **`ViewApi` has no orientation**, so an orbit camera cannot travel through
  the kit's `view`. The kernel declares a `camera3d` dep of its own.
- **`PoseDescriptor.remapBounds` and `fromBounds` throw.** A screen rectangle
  does not name a 3D pose without a depth. `getBounds` and `intersectsRect` run
  the other way and work, which is what drives selection chrome through an
  orbit.

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
