Applying a theme puts the header band back to the shape's stroke color when the new theme names none (A) — fixed 8f22d41cb8

setThemeValue writes values the theme checker rejects, so the document falls back to `night` (A) — fixed bb81e4fcdf. No rule existed, so I made the strict call: it throws a `RangeError` on any value `diagramThemeErrors` refuses at that path. Recorded in `docs/unruled.md`.

Applying a theme keeps the old theme's connector markers and trim (A) — fixed cc639714f0. `LineField` gains `markerStart`, `markerEnd` and `trim`, and markers or a trim set in an edge's `colors` are recorded as owned. The changeset is `minor` because adding those names is new API.

Applying a theme turns a requirement diagram's dashed connectors solid (B) — fixed ae3b049831. No rule existed, so I made the call: a connector's dash, markers and trim follow a theme only while they are still what the previous theme drew. This also keeps an entity-relationship diagram's crow's feet, which cc639714f0 alone would have stripped. Recorded in `docs/unruled.md`.

Applying a theme draws a container that names a theme role in the plain container colors (B) — fixed da75e66525. The container's role is now written into its trait, which the scene reader already expected, and the theme apply picks a region's colors the same way the builder does (`dataRegionStyle`).

An off-page tag's box keeps its old size when a theme changes the label font (B) — fixed d2ded8e403. The apply now re-measures the box with `offPageTagSize`, the function that sizes a new tag.

Applying a theme adds a fill to lanes that building never gave them (B) — fixed 4e4820856a. No rule existed, so I made the call: lanes built from data now get their theme's striped lane-body fills, as a theme apply and `addLane` already gave them. The draw-style XML writer and the DOT/Mermaid writer stopped stripping lane fills. Recorded in `docs/unruled.md`. Round 46 had ruled the XML writer's missing lane fill "not a defect", because building gave lanes no fill; that is now reversed.

setThemeValue accepts values diagramThemeErrors rejects (B) — duplicate of the setThemeValue finding from A, fixed bb81e4fcdf

Extra: none.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: themeEdit.test.ts pass (21), themeBand.scene.test.ts pass (1), themeEdgeLine.scene.test.ts pass (4), themeRegions.scene.test.ts pass (3), themeTagSize.scene.test.ts pass (1), containers/containerTheme.test.ts pass (3), diagram-formats dot/write.test.ts pass (24), drawXml/writeModel.test.ts pass (3).
- Related directories together (diagram theme, containers, offPage, all of diagram-formats, apps/chart lane and theme tests): 130 files, 1214 tests, pass. No browser test files touched.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/diagram` and `-w @weasel-js/diagram-formats`: neither package has a `lint` script. Root eslint on every changed `.ts` file: pass, exit 0. The gate's `npm run lint` also passed.
- `npm run check:changesets`: OK.
- Tree clean.

tally: 8 of 8 fixed, 0 extra fixed