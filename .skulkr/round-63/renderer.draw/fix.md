I fixed all five findings, one commit and one changeset each. Every touched test file passes, and `npm run checks:gate` passes.

- far-off rect clip stenciled at the wrong place (B): fixed 71d33ebaf3
- far-off rect's stencilled aligned stroke marks its fill at the wrong place (A+B): fixed 293a1962e0
- typed-array value for a non-array uniform silently dropped (A): fixed 85516181dc. An `Int32Array`/`Uint32Array` now writes `int`/`ivecN` or `uint`/`uvecN` by its length, and any other length throws in dev.
- text layer that falls back keeps its uploaded span's GPU buffers (A): fixed 6186b1ae03
- vertex colors with a non-solid paint: fill drops the colors, stroke drops the paint (B): fixed 57f479d2a2. This needed a behavior call nobody had made. I chose the stroke's existing rule for both: the vertex colors draw at the paint's opacity. It is recorded in `docs/unruled.md` under "Audit round sixty-three (2026-11-21): renderer.draw".

No extra defects found. I searched the renderer for the same polygon-only origin lookup. The other hits (`paintedBounds.ts`, `batchHull.ts`, `cache/markerCommandCache.ts`) work on polygon path coordinates rather than mesh vertices, and they are outside this area.

Checks:
- `npx vitest run --maxWorkers=1 packages/renderer/src/draw/rectMeshOrigin.test.ts`: pass (2)
- `npx vitest run --maxWorkers=1 packages/renderer/src/WeaselRenderer.shaderUniforms.test.ts`: pass (14)
- `npx vitest run --maxWorkers=1 packages/renderer/src/draw/textLayer.test.ts`: pass (1)
- `npx vitest run --maxWorkers=1 packages/renderer/src/drawPath.vertexColor.test.ts`: pass (7)
- `draw.strokeAlign.test.ts`, `drawClip.stencil.test.ts`, `drawPath.fillStroke.test.ts`, `drawText.layout.test.ts`, `draw.pathOrigin.test.ts` (neighbors, untouched): pass
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". The first run failed on `check:changesets` because one changeset title was too long; I shortened it and squashed that into its fix commit.
- `npm run lint -w @weasel-js/renderer`: the package has no `lint` script, so npm errors with "Missing script". I ran `npx eslint` on every changed `.ts` file instead: pass. The gate's root `npm run lint` also passed.
- Browser tests: none touched.
- Tree: clean, apart from the untracked `.skulkr/`.

tally: 5 of 5 fixed, 0 extra fixed