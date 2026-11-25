- `<tspan>` that sets only stroke-width, dash, cap, join, or opacity loses the inherited paint (A): fixed ce34b31a8e
- `<tspan stroke="inherit">` / `unset` comes out black with a warning (A): fixed ce34b31a8e (same root cause as the line above: the run's stroke was read from the tspan's own attributes instead of its full cascade)
- `text: 'embed'` declares the substituted face under the wrong family name (A): fixed 7a1b33421a
- `strokeDataFromSvg` drops `align` (A+B): fixed f7f6d2c611
- Fit-clamp drop leaves a group's stroke and border unscaled (A+B): fixed e6b3a69ca1
- Golden round-trip helper ignores polygon `origin` (A): fixed b94e6f7eef
- `dominant-baseline` is read only from the element's own attribute (A): fixed 9537ba130a
- Marker outline `stroke-width` ignores units (A+B): fixed abfb354149
- Absolute `baseline-shift` read as that many ems (A): fixed 9f81864712. One existing test expected `4px` to read as 4 ems with a warning; it now uses `4vw`, a unit that still can't be converted. The `supports.test.ts` sample was changed the same way.
- `<text>`-level `baseline-shift` dropped from `<tspan>` runs (B): fixed f0c7505cfa
- Fit-clamp turns an `INHERIT` stroke into an object of its characters (B): fixed e6b3a69ca1 (same commit as the group-stroke fix, which B reported in the same finding)
- Keyword values validated without regard to case but read with it (B): fixed 9a9b3acb88
- `<pattern>` `<image>` read without checking its `transform` or `preserveAspectRatio` (B): fixed e30e707dea
  - A transformed image now drops to the unsupported-pattern warning.
  - An explicit `preserveAspectRatio` other than `none` now warns and still reads stretched, matching how a bare `<image>` is handled.
  - A pattern image with no `preserveAspectRatio` still reads as an image fill with no warning. An existing test covers exactly that case for other editors' bitmap patterns, so I kept it. I didn't treat this as a new behavior call or add anything to `docs/unruled.md`.
- `roundTrip` helper drops most node fields before comparing (B): fixed b94e6f7eef. It now compares every field, with geometry in world coordinates. All golden fixtures still pass.
- Fit-clamp leaves a framed text leaf's `padding` unscaled (B): fixed 4d7f5bc65e
- Duplicate entries: A's align finding is the same as B's; A's group-stroke finding is the same as B's fit-clamp finding; A's marker-width finding is the same as B's.

Extra defects:
- A run's stroke replaces the node's stroke, but the `<tspan>` it was written as inherited the node's cap, join, dash, miter limit, and opacity, so a browser drew it differently from the canvas. The writer now writes those properties at their initial values: fixed ce34b31a8e. The old `roundtrip.text.test.ts` expectation that a tspan "inherits nothing else" contradicted how SVG draws it, so I updated it.
- `isDeclarationHonored` matched `inherit` only in lowercase: fixed 9a9b3acb88

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: `unpackFiles`, `unpack`, `readRuns.stroke`, `roundtrip.text`, `roundtrip.textScript`, `markers`, `readText.baseline`, `properties.case`, `patterns`, `testing/roundTrip`, `textModes`, `supports`: all pass.
- `packages/svg` whole: 1182 passed. `packages/text` + `packages/editing`: 4496 passed, 1 skipped.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/svg`: the package has no `lint` script. `npx eslint packages/svg/src` exits 0 instead.
- `npm run check:size`: "no file or function grew past its cap."
- `npm run check:changesets`: "OK — 2603 changeset(s)."
- No `*.browser.test.*` files were touched. The tree is clean.

tally: 17 of 17 fixed, 2 extra fixed