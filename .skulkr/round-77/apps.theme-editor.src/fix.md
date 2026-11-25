- Editing a pin drops its `description` and `scope` (A): fixed e5101cc724. It also now keeps the pin's own `type` instead of taking the derived token's.
- Ramp and scale editors read the stale last-good derivation instead of the draft (A): fixed 1f4d23dd79. A shared `draftChain` now serves Ramps, Scales and Semantics.
- Unpinning a swatch removes every anchor with its name (A): fixed 195140a261. It now unpins by color, and the "pinned" state is per color.
- Same unpinning finding (B): duplicate of A's, fixed 195140a261.
- "Copy as tokens" doesn't escape swatch names in the JSON (A): fixed 684c148b05.
- Anchor hue and lightness bounds don't cover colors a hex can pin (B): fixed 3933862855. The fields now take hue 0–360 and lightness 0–1. The claimed rewrite on blur doesn't happen: react-aria clamps a controlled value for display only and never calls `onChange` for it. What was really wrong is that the field showed 0.97 or 0.30 instead of the real lightness, and the test covers that.
- Stored constraints accept any string for `order` (B): fixed e21894ea8e. Same fix for any string as `surface` (now must be a hex) and for any array as `c.anchors` (now goes through `anchorsOf`).
- `fitted` undercounts what it trims, so a saved history can go over budget (B): fixed 7bccfcabac. It now measures the real size before accepting a fit. The existing test in `useLabHistory.persist.test.tsx` had been written around the undercount, so I changed its budget to the real size of a one-entry cut.

Extra:
- Stored anchors kept a lightness outside 0–1 or a negative chroma, both of which the engine rejects (sweep): fixed 349b13bfb6.

No changesets: `apps/theme-editor` has no `package.json`, so it isn't a published package.

Checks:
- Each touched test file run alone with `--maxWorkers=1`, all pass: TokenLayer 14/14, ScalesLayer 7/7, RampsLayer 11/11, SemanticsLayer 12/12, SwatchPanel 8/8, PalettePreview 4/4, AnchorList 5/5, presets 18/18, historyStorage 2/2, useLabHistory.persist 12/12. Two files I didn't touch also pass: PaletteLab 5/5 and ThemeWorkbench 17/17.
- Every new test was seen failing with its fix reverted.
- `npm run checks:gate`: "checks:gate: all 33 passed".
- No package lint script applies, since the app has no package. Root `npm run lint` passed inside the gate, and `npx eslint apps/theme-editor/src` gave no output.
- No browser tests touched. Tree clean.

tally: 8 of 8 fixed, 1 extra fixed