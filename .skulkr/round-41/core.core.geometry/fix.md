- Rect pose `lerp` drops `transform`, so `lerp(a, b, 1)` isn't `b` (A): fixed a69509ee7c
- Polygon axes `to`/`write` emit more numbers than `count`, overrunning the next row (A): fixed 993c15cc53
- Polygon `lerp` and `axes` take commands and fill rule from one side, so `lerp(a, b, 1)` draws `a`'s shape (A+B): fixed 90f7d4157c. `lerp` now throws when the command streams differ. Fields that don't interpolate come from the nearer end, as corners already did. `axes.add` builds from the pose it is given.
- `rotatedRectCorners` and `rotatedRectContainsPoint` ignore `transform`, and a flipped box contains no point (A+B): fixed bf25c36a50
- `AUTO_POSE_DESCRIPTOR.axes` treats a `{kind:'rect'}` Path as a rotatable rect pose (A): fixed 0e0c8470b2
- `outsetBox`/`insetBox` grow a flipped box inward (B): fixed 242232aa9f. `insetBox` stays the exact inverse, flip included.
- `AUTO_POSE_DESCRIPTOR.lerp` turns a Path-and-rect pair into a pose full of `NaN` (B): fixed ca297218bd. This needed a behavior call nobody had made: it now throws, the strict choice, recorded in `docs/unruled.md` under "Audit round forty-one (2026-11-19): core's geometry".

No extra defects. One extra commit, 698ee6656f, shortens five of my changeset titles that `check:changesets` refused for running past 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own:
  - `poseDescriptor.test.ts`: pass (12)
  - `pathPoseDescriptor.test.ts`: pass (9)
  - `autoPoseDescriptor.test.ts`: pass (17)
  - `rotatedRect.test.ts` (new): pass (3)
  - `inkExtents.test.ts` (new): pass (3)
  - `pathOrigin.test.ts`: pass (4)
  - `animation/target.read.test.tsx`: pass (28)
  - `canvas/rotationParity.test.ts`: pass (5)
  - editing `rotate/geometry.test.ts`: pass (14)
  - editing `resize.test.ts`: pass (17)
  - editing `resize.stroke.test.ts`: pass (4)
  - editing `resize.minSize.test.ts`: pass (8)
- `npm run checks:gate`: the first run failed on `check:changesets` (titles too long). After the fix: pass, "all 32 passed".
- `npm run check:changesets`: pass.
- `npm run lint -w @weasel-js/core`: **unrun**. A hook refused it as a suite-sized script on the controller machine and said not to rephrase around it. The gate's root `npm run lint` and `typecheck:packages` did pass.
- No browser test files were touched.
- Tree clean; `.skulk/` untouched.