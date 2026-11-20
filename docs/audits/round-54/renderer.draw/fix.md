Emoji in gradient- or pattern-filled text ignore the fill's opacity (A): fixed 65206e36cd

A batch run without `batchVariants` takes several color matrices but draws them with the single-matrix program (A): fixed b28917cee6

Text decorations and outline-tier glyphs lose float32 precision far from the origin because their meshes carry no origin (A): fixed 4554448a8f

A group's color matrix never reaches a registered paint kind, on paths or on glyphs (B): fixed abbe959178. This was a behavior call nobody had made, so I made the strict one and recorded it in `docs/unruled.md`. A kind's program that declares `u_colorMatrix` and `u_colorBias` is handed them. One that declares neither draws unmapped, and development warns once per program. Text through the scratch pass is covered because that pass binds through `bindPaintKind`. The changeset is `minor` because it adds a uniform convention for kinds.

A `Float64Array` given to an array uniform is rejected (B): fixed ad3ee7f4d4

A group with effects whose color matrix lowers alpha still claims picking ids at its unmapped alpha (B): fixed dad9f5cc1b. The id composite now applies the same matrix as the color composite, in both GLSL and WGSL.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `drawText.colorGlyph.test.ts`: pass (8)
  - `draw/batchRun.test.ts`: pass (2)
  - `drawText.origin.test.ts`: pass (8)
  - `draw/paintBind.colorMatrix.test.ts`: pass (2)
  - `WeaselRenderer.shaderUniforms.test.ts`: pass (12)
  - `draw/idComposite.test.ts`: pass (1)
- The neighboring renderer tests also pass: every `drawText.*.test.ts`, `paintBind.test.ts`, `drawBatch.colorMatrix.test.ts`, `groupEffects.test.ts`, `WeaselRenderer.renderIds.test.ts`, `kitPrograms.test.ts`, `wgslReflect.test.ts`, `draw.paintPrecision.test.ts` and `WeaselRenderer.paintResources.test.ts`.
- Each new test was seen failing with its fix reverted.
- `npm run checks:gate`: pass, "checks:gate: all 32 passed". The first run failed on typecheck and on changeset title length; both were fixed and folded into their commits.
- `npm run lint -w @weasel-js/renderer`: not run, because the renderer has no `lint` script. Instead, `npx eslint` on every changed `.ts` file: pass.
- WebGPU's id-composite path is covered only by the browser parity tests, which can't run here: unrun.
- The tree is clean.

tally: 6 of 6 fixed, 0 extra fixed