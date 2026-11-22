Every finding checked out as a real defect and each has a fix, test and changeset, with `checks:gate` passing.

- Below-the-top `roots` export drops the paint a root inherits (B) — fixed 4b9333f1e3
- A marker key like `grad0` gets the same `<defs>` id as a gradient, pattern, clip or text cut (B) — fixed f77ce2ac21
- A filled, unstroked path with open subpaths is written as a group with an extra `<path>` that draws nothing (A) — fixed 9adf9e3fd2
- `revert` and `revert-layer` are kept as the literal word instead of rolling back (A) — fixed 02aed7974b
- `svgStrokeFromKit` silently drops `varyingWidthJoinThreshold` and `vertexColors` (A) — fixed 6d60522df6. The threshold is now carried through export and import and used for the outline. Vertex colors are still left out but now warn through `onWarn`, matching the painter path.
- A nested `<svg width="auto">` gives its children no viewport for percentages (A) — fixed d0d077c026
- A `container` shorthand declared after `container-type` does not reset it (A) — fixed 5ca44f83c5

Extra, found while fixing:
- The painter path warned on a fill's vertex colors but not on a stroke's (sweep) — fixed 6d60522df6, in the same commit as the `vertexColors` warning.

Checks:
- Each new test failed before its fix and passes after.
- `npx vitest run --maxWorkers=1`, one file at a time: `fromKit.test.ts` 36 passed, `cascade.test.ts` 66 passed, `container.test.ts` 10 passed, `lengths.test.ts` 29 passed, `openSubpathFill.test.ts` 14 passed, `markerSerialize.test.ts` 13 passed, `strokeOutlineSvg.test.ts` 17 passed. `painterLeaf`, `parse`, `serialize` and `markers` tests together: 83 passed.
- `npm run check:changesets`: OK, 9 changesets.
- `npm run checks:gate`: all 32 passed.
- `npm run lint -w @weasel-js/svg`: the package has no lint script (npm error, missing script). The gate's root `npm run lint` passed, which covers it.
- The tree is clean.

tally: 7 of 7 fixed, 1 extra fixed