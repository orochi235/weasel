HTML table cells run together — A+B: fixed 2e42a5c106

`<pre>` whitespace folded — A+B: fixed 58215b780c

Moved edge label falls back to the line's start when the last stretch has no length — A: fixed e78688ed78

Placeholder values parsed as markup in an HTML label — B: fixed 6659638dc6 (behavior call: the value is escaped before it is filled in; recorded in `docs/unruled.md`)

Hollow `oval`/`box`/`classic` arrowheads read as filled with no warning — B: fixed 6a7851a888 (warns; the diagram has no hollow circle or square marker)

Exit/entry points snap to the nearest compass port with no warning — B: fixed a018361079 (warns for a point off a side's middle, and for a nonzero `Dx`/`Dy`)

Underline and strikethrough in `fontStyle` dropped silently — B: fixed cdafec6a80 (warns; `RowTextStyle` has no underline or strikethrough)

Hidden cells and layers (`visible="0"`) imported as visible — B: fixed 29b8569e44 (behavior call: hidden cells, everything under them, and connectors with an end on one are left out with one warning; recorded in `docs/unruled.md`)

Checks:
- `npx vitest run --maxWorkers=1` on each test file touched or affected: cellText.test.ts pass (10), fidelity.test.ts pass (29), read.test.ts pass (33), readModel.test.ts pass (14), roundTrip.test.ts pass (7), write.test.ts pass (24). Every other drawXml test file also passes.
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed on typecheck, typecheck:packages and check:changesets. I fixed those and folded the fixes into their commits.
- `npm run lint -w @weasel-js/diagram-formats`: fail ("Missing script: \"lint\""). The package has no lint script. `npx eslint` on every changed `.ts` file: pass (exit 0).
- `npm run check:changesets`: pass ("OK — 9 changeset(s)").

tally: 8 of 8 fixed, 0 extra fixed