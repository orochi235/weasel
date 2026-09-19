# @weasel-js/kernel3d

## 1.5.1

### Patch Changes

- Updated dependencies [f644eac]
- Updated dependencies [b984947]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [f663199]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [f9feecc]
- Updated dependencies [c0fa540]
- Updated dependencies [21ce23e]
- Updated dependencies [ff17dd7]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1
  - @weasel-js/geom@1.5.1

## 1.5.0

### Patch Changes

- 2f1ddd0: `@weasel-js/kernel3d` is a new package: poses, an orbit camera, ray picking and screen-projected chrome geometry over core's scene graph and dispatcher. It hosts a renderer rather than owning one — a consumer brings its own and the kernel hands it poses — and it takes core as a peer, the same tier `svg`, `diagram` and `loupe` sit in.
  
  Core took no diff for it. `Scene` is generic over its pose and holds a `Pose3` with no adapter; a 3D host passes the dispatcher an identity `clientToWorld` so `ctx.world` stays two numbers and each dep rebuilds the ray from the camera it closes over; tools transfer untouched. The two things that do not transfer are stated rather than guessed: `ViewApi` has no orientation, so the kernel declares a `camera3d` dep of its own, and `PoseDescriptor.remapBounds`/`fromBounds` throw, because a screen rectangle does not name a 3D pose without a depth.
  
  `@weasel-js/geom` gains a `./3d` subpath — vectors, quaternions, 4x4 matrices, ray/AABB and ray/plane intersection, and `transformAabb`. Dependency-free like the rest of the package, and immutable tuples rather than classes, so a pose survives `structuredClone` with its methods intact because it never had any.
  
  Two corrections to code promoted out of the 3D lab. `projectAabbToScreen` now clips each of the box's twelve edges against the near plane instead of dropping the corners behind it; the old behaviour reported a box too small for anything straddling the near plane, and reported almost nothing for a solid the camera sits inside. And the seam that says how big a node is now asks for its world box rather than a local one to transform: a sphere's box is the same under every rotation, and no transform of a local box reproduces that.
  
  `sceneFromJSON`'s `options` argument is now optional. Every field in it already was, so the natural one-argument call did not compile.
  
  Also new: a test that a quaternion pose survives `toJSON` and `sceneFromJSON` with its rotation intact. The claim that `Scene` is dimension-neutral had only ever been run against `setPose` and undo.
- aa45d32: `@weasel-js/geom/3d` now judges singularity the way the 2D kernel does: against the matrix's own scale, never against an absolute floor.
  
  - `invert` on a 4x4 compares the determinant with the product of the four column lengths. A uniformly tiny matrix, such as a scale of `1e-4`, now inverts; so does a projection with a very small near plane. A large matrix whose determinant is only rounding now returns `null`, and so does a matrix holding `NaN`, which used to come back as a matrix of `NaN`s.
  - `normalize` keeps the direction of any vector with a finite, non-zero length. It used to return the zero vector below a length of `1e-9`, which collapsed `lookAt` for a camera less than `1e-9` from its target.
  - `lookAt` returns a singular matrix when `up` is parallel to the view to within rounding, as it already did when exactly parallel.
  - `transformPoint` always divides by w. It used to skip the division below `|w| < 1e-9`, so a camera with a far plane beyond about `1e9` cast rays in the wrong direction.
  - `intersectRayAabb` and `intersectRayPlane` accept a direction of any length. A ray counts as parallel to a plane only to within rounding of its own length.
  - `EPS3` is removed. Nothing in the subpath uses an absolute tolerance any more. This is a breaking change for anything that imported it.
  
  In `@weasel-js/kernel3d`, `rayThroughScreenPoint` now returns `null` when the view-projection has no inverse or the pane has no area. It used to return a made-up ray from the eye straight down -z. This is a type-level breaking change. The built-in deps handle `null`: `createNodeAtPoint` picks nothing, `createInsert` inserts nothing, and the pose descriptor's `translate` keeps dragging through the last camera that did cast a ray. `projectAabbToScreen` no longer drops points closer to the eye than `1e-9`, so a scene at a tiny scale projects the same as it does at unit scale.
- a5f738a: Resolve a screen rectangle at a pose's own depth, and stop deriving a group's
  bounds from poses the kit cannot read.
  
  `kernel3d`'s `PoseDescriptor.remapBounds` and `fromBounds` threw: a rectangle on
  screen names a pose only once something says how far away it is. Both now
  resolve it on the plane through the pose they were handed, facing the camera, so
  neither changes depth. A resize scales uniformly — two screen extents cannot
  name three — and `fromBounds` returns a world-axis-aligned box whose third
  extent is the mean of the two the rectangle gives it.
  
  `core`'s `unionOfChildren`, which every scene carries under
  `kit:unionOfChildren`, read its members as rects with no check and produced a
  box of `NaN` in a scene posed otherwise. It now declines, and the container
  keeps its authored pose; `unionOfChildrenVia(descriptor)` remains the way to
  make such a container track its members.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [aa45d32]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/geom@1.5.0
