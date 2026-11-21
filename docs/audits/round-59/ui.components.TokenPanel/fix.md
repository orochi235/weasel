TokenPanel findings: 14 given (6 from A, 8 from B), 11 distinct after merging duplicates. All fixed in 11 commits, each with its own changeset.

- Translucent token's alpha dropped when the swatch picks a color (A+B) — fixed bae371a2ac
- Runs never form under the default `namePrefix: ''` or `'wzl-'`, because the name kept its `--` while the group lost it (A+B) — fixed 30bce14ec0. Names now drop their `--` everywhere they are drawn, so a lone row with no prefix now reads `gap`, not `--gap`.
- Scale's Reset pushes the name to a second grid row (A) — fixed 0666f86122. The new `TokenPanel.browser.test.tsx` did run here: it fails before the fix and passes after.
- `factors` scale with base 0 writes an Infinity factor when a step is dragged; a negative base writes a negative one (A) — fixed 423be585ac
- Dragging a step with no entry in `factors` does nothing, and base 0 gives Infinity (B) — duplicate of the previous finding, fixed 423be585ac. I made a behavior call here and recorded it in `docs/unruled.md`: a dragged step that no factor can reach now overrides the step through `onChange`. Refitting to factors from a negative base now gives factors of 1, as a zero base already did.
- Refitting to `ratio` with a non-positive last step gives NaN or 0 (A) — fixed 875a16c9fa
- Sorting tokens into sections copies the section on every token, which is quadratic (A) — fixed 91e7cf1ed9. There is no test that fails before: a cost like this can't be asserted deterministically in a unit test.
- `refitScale` rounds to 2 places, so switching rule moves the steps; dragging uses 3 places (B) — fixed a2da7a20bd. Both now round to the 4 places the number fields show. Two existing expectations changed: 1.34 → 1.3416 and 1.583 → 1.5833.
- A run row named exactly as its group draws a blank name when it is not the first row (B) — fixed 629de383be
- A family's picked-step label ignores `namePrefix` (B) — fixed 6fc9c6250e
- `inferTokenType` reads an upper-case duration as a string (B) — fixed 62f54fe0e5
- `isShadow` accepts `inset` only as the first keyword (B) — fixed 8421ce6d30

Extra defects: none.

Checks:
- `TokenPanel.test.tsx`: pass (26)
- `color.test.ts`: pass (4)
- `tokenTypes.test.ts`: pass (6)
- `tokenTypes.pbt.test.ts`: pass (6)
- `TokenPanel.hold.test.tsx`: pass (5)
- `TokenPanel.browser.test.tsx`: pass (1)
- `npm run checks:gate`: pass ("all 32 passed"). The first run failed `check:changesets` on five titles over 140 characters; I shortened them and squashed each fix into its own commit.
- `npm run lint -w @weasel-js/ui`: fail, "Missing script: lint" (`@weasel-js/ui` has no lint script). `npx eslint packages/ui/src/components/TokenPanel`: pass.

The tree is clean.

tally: 14 of 14 fixed, 0 extra fixed