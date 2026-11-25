[A1+B1] world-unit `vertexWidths` and `{ length }` trim edges in the em-space glyph stroke (A+B): fixed b329e09677

[A2] `GLTextureCache` shares one texture between a straight font atlas and a premultiplied registered texture under the same id (A): fixed aa05f30483. This needed a behavior call, so I made the strict one and recorded it in `docs/unruled.md`. A shared id now warns once. Each upload rewrites the texels in its own alpha convention, and whichever uploads last decides whether a sweep may delete the texture.

[A3] `GLMeshCache` hands out dead handles after `dispose`, and leaks what it uploads after that (A): fixed 771496f07d

[A4] `GLImageCache` hands out deleted textures after `dispose` (A): fixed f0d74c6c3f. The same fix covers `abandon`.

[B2] the glyph fill cache ignores the default open-fill rule (B): fixed 8279270418. The same mistake was also in an inner or outer glyph stroke, which is cut to the glyph's fill. That is fixed in the same commit.

[r85-1] `GLMeshCache` returns a cached handle without checking the attribute (carried): not a defect (no longer applies). `handleFor` now compares the attribute with `sameAttribute` and replaces the upload when it differs.

Checks:
- `npx vitest run --maxWorkers=1` passed for each of these files:
  - `glyphOutlineMesh.test.ts` (new)
  - `cache/outlineMeshCache.test.ts`
  - `cache/outlineStrokeMeshCache.test.ts`
  - `cache/GLTextureCache.test.ts`
  - `cache/GLMeshCache.test.ts`
  - `cache/GLImageCache.test.ts`
  - `drawText.rotate.test.ts`
- Every new test fails on the code before its fix.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/renderer`: fail. The renderer package has no `lint` script ("Missing script"). Instead I ran `npx eslint` on every changed `.ts` file: pass, exit 0. It also printed `_pw_npm_token: command not found`, a shell-profile message unrelated to the lint.
- Tree clean.

tally: 6 of 7 fixed, 1 extra fixed