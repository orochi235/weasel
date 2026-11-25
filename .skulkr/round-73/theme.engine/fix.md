[r56-2] child by-axis pin restores the parent's pin on a step the child generates (carried) — not a defect (no longer applies: `fold`'s `parentPin` returns nothing for a token the child shadows, and merge.test.ts "fills its own by-axis pin from the parent's only where it does not produce the token itself" covers it)
[r56-5] `feasible` describes the palette before equalization (carried) — not a defect (no longer applies: `generate` checks the gates again with `meetsGates` on the equalized hexes)
[r56-6] `order: 'hue'` sorts anchors by raw hue (carried) — not a defect (no longer applies: anchor hues go through `wrapDeg` before sorting)
[r56-7] token on two axes is declared only in blocks naming both (carried) — not a defect (no longer applies: `blocks` declares it in every subset of its axes, ruled in docs/unruled.md in round 64)
[r56-8] token only a non-default theme declares is never reset (carried) — not a defect (no longer applies: `defaultLacks` and each plan's `lacks` set it to `initial` under every other theme)
[r56-11] `derive` reads a dotted reference whole (carried) — not a defect (no longer applies: `refName` is now `refTarget`, which drops the group; I ran `derive` with a pin `{color.accent}` and a semantic `ref: 'color.accent'` and it did not throw)
`axisDependencies` settles an inherited step that a child's step replaces at only some selections (A) — fixed a69edba282
duplicate anchor naming a missing step reported as "already fills" (A) — fixed d0260726d4
`emitThemes` writes an unparseable `TokenName` when no theme has a token (A) — fixed befa775285
`generateTokens` accepts two definitions with the same name (A) — fixed 4044b72f39
`generateTokens` accepts two definitions with the same name (B) — duplicate of A's same finding, fixed 4044b72f39
`emitCss` gives an inherited token the non-default theme's own default at an axis value only that theme declares (B) — fixed b64507f499
pin over a failed rule never reported as untyped (B) — not a defect (deliberate: derive.test.ts "does not report an untyped pin over a semantic whose rule failed" asserts it, and commit 583e73594a says a pin over a failed rule is not reported again; the rule's own failure is still an issue, and that issue alone makes `generateTokens` refuse the set)

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1` deps.test.ts: 26 passed. derive.test.ts: 60 passed. emit/tokens.test.ts: 8 passed. emit/emit.test.ts: 27 passed. I also ran deps.shrunk.test.ts and emit/css.pbt.test.ts, both passing.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed `check:changesets` on two titles over 140 characters; I shortened them and folded the edits into their own commits before the passing run.
- `npm run lint -w @weasel-js/theme`: the package has no `lint` script ("Missing script"). Instead I ran eslint on every file I changed, which exited 0.
- The tree is clean.

tally: 6 of 13 fixed, 0 extra fixed