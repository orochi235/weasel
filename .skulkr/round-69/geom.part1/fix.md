Short cubic-bezier easing bisection (A): fixed efde6a2e57 (changeset title shortened in 00da64dad1)

bezierCubic offers handles no segment reads (A): fixed 2ddcf84592

3D `invert` gives a NaN/Infinity translation for a non-finite translation (B): not a defect. For an affine input, `b02`, `b04` and `b05` are exactly 0, so any infinite `b06`, `b07` or `b09` makes the determinant `0 × ∞ = NaN`, and `invertible` then returns null. I checked this with a test, which passed on the unfixed code for `Infinity` and `NaN` translations, so I removed it.

pathCrossings reports a one-cubic closed subpath's closing joint as a self-crossing (B): fixed 4972cc655e

pointAtLength next to a zero-length segment uses a curved neighbor's chord instead of its tangent (B): fixed 11cf321736

Checks:
- `npx vitest run --maxWorkers=1` on each file touched: `easingSpec.test.ts`, `curves/bezierCubic.test.ts`, `intersect/intersect.test.ts`, `along/lengthTable.test.ts` and `3d/3d.test.ts` all pass. Each new test failed before its fix.
- Related files, all pass: `along/curvePosition.test.ts`, `3d/along3.test.ts`, `paths/pathMeasure.test.ts`, `curves/curve-conformance.test.ts` and `stroke/src/trim/trim.pbt.test.ts`.
- `npm run check:changesets`: OK, 231 changesets.
- `npm run checks:gate`: all 33 passed.
- `npm run lint -w @weasel-js/geom`: not run, because the package has no `lint` script (npm error: missing script). The gate's root `npm run lint` passed.
- Tree clean.

tally: 4 of 5 fixed, 0 extra fixed