- Pin/component `description`, `alpha`, `type` not shape-checked; bad description crashes `emitCss` (A+B): fixed 8051b9a683. This was a call nobody had made, so I made the strict one and recorded it in `docs/unruled.md`: a malformed pin or component is reported `invalid` and makes no token. An `alpha` outside 0 to 1 is now reported on semantic `ref`s too.
- `equalize` raises a muted anchor's chroma (A): fixed 6dffd23df7
- `feasible: true` after equalizing pushed the palette out of its gates (A): fixed 46e9d62d44
- Child's by-axis pin filled from a parent pin the child's own ramp shadows (A): fixed fadb6b6195
- Inherited parent pin overrides a semantic the child redefines (A): fixed 82dcbfe327
- `axisDependencies` keeps the last producer of a duplicated name, `derive` the first (A): fixed eb0c6a23ec
- `generate` returns more swatches than `count` when it has more anchors (A): fixed e46711564d. This was also a call nobody had made, recorded in `docs/unruled.md`: `generate` keeps the first `count` anchors and calls the palette infeasible, and `derive` reports the extra anchors as `invalid`. The generator's property test asserted the old length, so it now expects `count`.
- Parent pin overrides the child's own semantic or component (B): duplicate of "Inherited parent pin overrides a semantic the child redefines" (A)
- `derive` throws on an axis loaded as `null` (B): fixed b4794b627e. The axis helpers in `axes.ts` now handle a non-object axis too, so `bake` and `axisDependencies` don't throw either.
- Pins and components not shape-checked like semantic rules (B): duplicate of "Pin/component `description`, `alpha`, `type` not shape-checked" (A)
- `{seeds.x}` inside a pin or component list never resolved (B): fixed a2e4146154
- `emitThemes` loses a `__proto__` theme or axis value in object literals (B): fixed 98036c82b3
- Hue search can return 360, so `order: 'hue'` sorts it last (B): fixed d68d6b8901. No end-to-end case turned up in a probe, so the test is on `seedRings` (exported for it) and fails before the fix.

No extra defects.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `axisIssues.shrunk.test.ts` 4 passed, `color/generate.pbt.test.ts` 2 passed, `color/generate.test.ts` 22 passed, `color/hueSearch.test.ts` 1 passed, `deps.test.ts` 19 passed, `derive.test.ts` 54 passed, `emit/emit.test.ts` 23 passed, `merge.test.ts` 9 passed. No `*.browser.test.*` file touched.
- `npm test` in `packages/theme`: before the property-test update, 1 failed | 620 passed; that file passes now.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` (seven titles over 140 characters) and `check:size` (`axisDependencies` over 120 lines); both are fixed in the commits they belong to.
- `npm run lint -w @weasel-js/theme`: fails with "Missing script: lint", because the package has no lint script. `npx eslint` on every changed `.ts` file passed.
- Tree clean, `.skulkr/` untouched.

tally: 11 of 13 fixed, 0 extra fixed