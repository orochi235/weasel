# Review saturation for `kernel3d`

Snapshot `6be7338b8bdce6605ac6e3dc75ee21365f18be5e`. The tracked working tree was clean at the start of review. Scope is the 41 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Projection, ray parameterization, and pick-index clipping | 1 | 1 | 0 |
| 2 | Camera input, limits, pose composition, and motion | 0 | 1 | 1 |
| 3 | Line packing, shader depth, and WebGL state ownership | 0 | 1 | 2 |
| 4 | Snap candidates, axis handles, insert footprints, and overlay geometry | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Unit-length screen rays make point picking stop one world unit from the near plane

[screen.ts](packages/kernel3d/src/screen.ts#L89) · Pass 1 · high · Source-traced

rayThroughScreenPoint normalizes far minus near, but point picking in deps.ts caps its ray parameter at 1 because the ray is documented to reach the far plane at t=1. The AABB intersection uses the supplied direction directly. With the camera facing a box more than one world unit from its near plane, the box can be visibly inside the frustum and still be rejected by createPickNearest and createNodeAtPoint3dDep. The existing straight-ahead test in screen.test.ts also expects the full near-to-far displacement.

Source and tests were left untouched.
