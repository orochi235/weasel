- Lane `fillColor=none` drops themed lane fills (A): not a defect. `regionData` in `packages/diagram/src/containers/regionSpecs.ts` draws a lane with no fill, so `none` writes what the diagram shows. A related real defect is listed under extra defects below.
- Cluster `label` dropped on write (A): fixed 0593f8fcdc
- A container's `lanes` lose their members from the file (A): fixed 4762667d7d
- `arrow-concave` written as `classic` reads back as `arrow` (A): fixed 307d5dacdd. Question: this needed a behavior call. An end whose style names no arrowhead now reads as unset (the diagram's own marker), not as draw.io's default `classic`. Recorded in `docs/unruled.md`.
- Two end labels at one end, one dropped silently (A+B): fixed 647723f67f
- Group holding only containers dropped silently, and edges to it get the wrong warning (A+B): fixed 9bbbf664cb
- Dropped cells still claim ids across pages (A): fixed 6451503b40
- Relative vertex geometry under a vertex read as pixels (B): fixed 78ab3ee03a
- Edge label `offset` point ignored (B): fixed eaf4ce703a. The label is placed on a straight line through the edge's ends and bends, since the read can't know the routed path.
- Triangle and trapezoid `direction` ignored (B): fixed f59d428269. Such a shape still reads as its outline, now with a warning. This covers every known shape that a turn changes, not only triangle and trapezoid.
- `segmentEdgeStyle` reads as straight (B): fixed 8896aa6ead. The side-to-side and top-to-bottom edge styles are fixed too.
- Multi-line edge and region labels lose their breaks (B): fixed ea2f4fa52d
- Swimlane with no `startSize` measured as having no header (B): fixed 4f14be0d36
- Fallback cell id can equal a real id (B): fixed 860dc2d51e

Extra defects found while fixing:
- Containers and pools filled only in their header in draw.io (sweep): fixed 52dec5ea91. Draw.io fills a swimlane's body from `swimlaneFillColor`, not `fillColor`. The region's body fill is now written there and read back from it.

Checks:
- Touched test files, each run alone with `--maxWorkers=1`: readModel.test.ts (new) pass, writeModel.test.ts (new) pass, read.test.ts pass, write.test.ts pass, roundTrip.test.ts pass, drawXml.pbt.test.ts pass. All of `packages/diagram-formats/src/`: 763 passed.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed typecheck, typecheck:packages and check:changesets. I fixed those and folded the fixes into their own commits with an autosquash rebase of my commits only, above the frozen base.
- `npm run lint -w @weasel-js/diagram-formats`: fail, "Missing script: lint". The package has no lint script, so I ran eslint on every changed `.ts` file instead: pass (exit 0).
- `npm run check:changesets`: pass, "OK — 2040 changeset(s)".
- Tree clean, `.skulk/` untouched.