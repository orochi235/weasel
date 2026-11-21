A gave 9 findings and B gave 12, which makes 21 as listed and 14 once the overlaps are merged. All 14 are fixed. Each fix is its own commit except the two `keyLegendsFromChord` findings, which share one rewrite.

- `keyLegendsFromFormatted` drops or swallows the plus key in `Ctrl++` / `Ctrl+Shift++` (A+B): fixed 55034091e9
- `KeyDiagram` ignores a `keys` entry's `label` when given a layout (A+B): fixed 3c37b9e4b8. With a layout, a key keeps the layout's width. The `keys` doc now says so.
- `KeyDiagram` ignores a `keys` entry's `width` without a layout (A): fixed 2e7da39aaa
- `useLinger` shows the diagram after `linger` is turned on later (A): fixed 0ca12715ee
- `data-captioned` counts marks on keys the diagram doesn't draw (A+B): fixed 6d8e6eb165
- `keyGlyph` upper-cases whole key names, unlike `keyLegendFromKey` (A+B): fixed 840c15b659. It now calls `keyLegendFromKey` for macOS, so its own copy of the key table is gone.
- KeySequence story describes `joins: 'key'` wrongly (A+B): fixed dd7b22b79e
- KeyCap gallery labels ⎋ as `wide` (A+B): fixed 434b76fe3b. The kind column now prints what `inferKeycapKind` returns for each chip, so it can't drift.
- Story relabeler maps ⇪ to Meta (A+B): fixed cfd0fea88d
- `keyLegendsFromChord` takes Ctrl/Meta as the key and drops keys after the first (B): fixed a519ef8276
- `keyLegendsFromChord` orders modifiers two different ways (B): fixed a519ef8276. Same commit as the one above, with a changeset for each.
- `useHeldKeys` lets go of every key when Meta comes up, on every platform (B): fixed 58a8120abb. That workaround now runs only where `isApplePlatform()` is true. The Command test in `KeyDiagram.test.tsx` now fakes a Mac platform.
- Legend fitting measures an icon legend's character, not the icon drawn at 1.25× (B): fixed 7aa1407999. `LEGEND_ICONS` moved to `legendIcons.ts` so the fit can check it, and the new `fitForm` is tested directly.
- KeyBank story's width control has no effect below about 1.45 key heights (B): fixed 139e27fe78

No extra defects found. Nothing went into `docs/unruled.md`, because no finding needed a behavior call.

The four story-only fixes (the `joins` text, the gallery kind column, ⇪, and the KeyBank width control) have no test and no changeset, since stories don't ship. Each other fix has a test I watched fail before the fix and pass after.

Checks:
- `keyLegendsFromFormatted.test.ts`: pass (3)
- `keyLegendsFromChord.test.ts`: pass (5)
- `keyGlyph.test.ts`: pass (1)
- `useHeldKeys.test.tsx`: pass (3)
- `KeyDiagram.test.tsx`: pass (13)
- `legendMeasure.test.ts`: pass (1)
- `Keycaps.test.tsx`: pass (39)
- `KeyBank.test.tsx`: pass (1)
- `InlineMarkdown` tests: pass (18)
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` on five titles over 140 characters; I shortened them and folded each into its own commit.
- `npm run lint -w @weasel-js/ui`: fail, `Missing script: "lint"` (the package has none). In its place, eslint on every changed file: pass. `check:size`: pass.
- Unrun: the `*.browser.test.*` files, including `KeyboardLayout.browser.test.tsx` and `KeyBank.browser.test.tsx`, which can't run here.

The tree is clean apart from `.skulkr/`.

tally: 14 of 21 fixed, 0 extra fixed