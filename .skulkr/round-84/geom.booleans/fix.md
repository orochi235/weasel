- Even-odd fallback fills a ring's self-overlap by nonzero (A+B): fixed 0f8a3e55b5
- `orientBoundaries` probe step has no floor for the coordinates' size, so a small contour far from the origin is dropped (A): fixed fbcd10741a. The same floor now also applies to `coverEdges`' probe in `cutContours`.
- `groupRings` can loop forever when two rings share every vertex (B): not a defect. With a single operand, `contourFaces` gives every filled face the same key and drops the edge between two neighboring filled faces, so it never emits a hole and a neighbor's outer loop on the same vertices. Rings that don't meet can't contain each other both ways. A doubly wound ring and a pentagram past the 4096-edge limit both finished promptly under both fill rules.

Checks:
- `npx vitest run --maxWorkers=1 packages/geom/src/booleans/adapter.test.ts`: pass (17)
- `npx vitest run --maxWorkers=1 packages/geom/src/booleans/contours.test.ts`: pass (4)
- `npx vitest run --maxWorkers=1 packages/geom/src/booleans/curveBoolean.test.ts`: pass (47)
- `npx vitest run --maxWorkers=1 packages/geom/src/booleans/splitBySegment.test.ts`: pass (65)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/geom`: not run, because `@weasel-js/geom` has no `lint` script. The root `npm run lint` passed inside the gate.

tally: 2 of 3 fixed, 0 extra fixed