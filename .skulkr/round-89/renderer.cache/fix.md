Gradient ramp atlas: a stop that fails to parse on a full atlas left two stop lists on one row (B): fixed ad50e24f4e

Glyph page made by `uploadR8`/`uploadRGBA` gets overwritten by a later image upload under its id, with no warning (A): fixed 2480c607a8. Recorded in `docs/unruled.md` as the fixer's call: whichever came first is kept and a warning prints once. An image is never written over a page, and a sweep never deletes a page.

A registered texture drawn after the frame's sweep is kept until the registry next changes (A): fixed d2c8c9c577

[r85-1] `GLMeshCache` returns a cached handle without checking the attribute (carried): not a defect (no longer applies). `handleFor` now compares attributes through `sameAttribute`, and `GLMeshCache.test.ts:200` covers it.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/cache/GradientRampAtlas.test.ts`: pass (30/30)
- `npx vitest run --maxWorkers=1 packages/renderer/src/cache/GLTextureCache.test.ts`: pass (15/15)
- `npx vitest run --maxWorkers=1 packages/renderer/src/cache/GLTextureCache.pages.test.ts`: pass (3/3)
- `npx vitest run --maxWorkers=1 packages/renderer/src/cache/GLTextureCache.rgba.test.ts`: pass (2/2)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/renderer`: not run, because the package has no `lint` script. Instead, `npx eslint` on the five changed source and test files: pass.
- The tree is clean apart from `.skulkr/`.

tally: 3 of 4 fixed, 0 extra fixed