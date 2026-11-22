I found seven distinct findings among the nine listed, and fixed all of them in seven commits on top of the frozen tree, one per fix. The ruling that NaN reads as a param's default didn't cover bevel2's `lightFrom`, so I made the strict call there: it now throws. I also made a call that shadow and sunbeams skip outline badges. Both calls are recorded in `docs/unruled.md` under round sixty-seven.

- Drawn effects let a NaN through their clamps (A, plus the NaN half of B's opacity finding): fixed 41f5d8a8d5. Every drawn effect, not just the ones cited, now reads a NaN or infinite number param as its default. Repeat counts keep their existing handling.
- bevel2 draws its bands black for a non-finite or non-numeric `lightFrom` (A+B): fixed 105ae4737a. It now throws a `RangeError` naming bevel2.
- NaN opacity draws at full strength in shadow, sheen, woodgrain, and sunbeams (B): duplicate of the first finding, fixed in 41f5d8a8d5.
- bevel2's non-finite `lightFrom` (B): duplicate of the second finding, fixed in 105ae4737a.
- Woodgrain's grain stops at a fixed -5..105 span (A): fixed 2a654b4d99. The grain now spans the outline's whole region and draws as before on an outline inside the box.
- Perforations rounds its hole count up, so holes can overlap (A): fixed 6aa9ebfc8f. It now rounds down, as bites and scallops do.
- Shadow and sunbeams draw on an outline badge (A): fixed d3368b0454. Both now draw nothing on an outline badge, as the other drawn effects do.
- Rivets picks a crossing behind the corner when the outline reaches past it (B): fixed b437f4affe. Crossings behind the corner are ignored, and a corner inside the body puts the rivet `inset` in from the corner itself.
- Aqua's `equatorSpread` doc says half-width but the band is lopsided (B): fixed 6c0122cbc9. This is a doc-only change, so it has no changeset.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`: `effectGeometry.test.tsx` 35 passed, `effectParams.test.tsx` (new) 14 passed, `effectColors.test.tsx` 2 passed, `effectHookOrder.test.tsx` 6 passed, `bumps.test.ts` 8 passed, and `Badge.test.tsx` 47 passed. No browser test files were touched.
- `npm run checks:gate`: 31 of 32 passed on the first run; `check:changesets` failed on four titles over 140 characters. I shortened the titles and folded each into its fix commit; `npm run check:changesets` then passed ("OK — 104 changeset(s)"). I did not rerun the whole gate afterward, since only changeset text changed.
- `npm run lint -w @weasel-js/ui`: fails with "Missing script: lint", because the ui package has no lint script. The root `npm run lint` inside the gate passed.
- The tree is clean.

tally: 9 of 9 fixed, 0 extra fixed