- `painted` keeps the last fill when it can't parse a color (A): fixed 88884cb702
- `trigger(label)` doesn't escape or anchor the label (A): fixed 0482f54658
- `painted`/`lineContrast` treat a translucent result as opaque (A): fixed 1d71392e49. My call, recorded in `docs/unruled.md`: a translucent ground now throws unless you pass the `backdrop` it's drawn over.
- `storiesOf` ignores include/excludeStories and CSF 2 hoisted annotations, and drops parameters and globals (A): fixed d179a5ac23, 200675b744 and 9f2b5a5625
- `readModuleCss` inlines only single-quoted `./` imports (A): fixed 42ab3b7f8c
- `storiesOf` runs a native module's non-story exports as stories (B): fixed d179a5ac23
- `storiesOf` ignores a CSF meta's includeStories/excludeStories (B): duplicate of A's `storiesOf` finding, fixed d179a5ac23
- `storiesOf` drops a CSF 2 story's hoisted args and decorators (B): duplicate of A's `storiesOf` finding, fixed 200675b744
- `csf()`'s context leaves out globals and the display name (B): duplicate of A's `storiesOf` finding, fixed 9f2b5a5625. Native stories now get forge's display name and the meta's title too.
- `selectRow`'s `trigger` builds an unescaped RegExp (B): duplicate of A's `trigger` finding, fixed 0482f54658
- `painted()` on a transparent canvas misreads a translucent ground (B): duplicate of A's translucent finding, fixed 1d71392e49
- `readModuleCss` inlines only `./` single-quoted imports, and two sheets importing each other overflow the stack (B): duplicate of A's `readModuleCss` finding, fixed 42ab3b7f8c. It now throws on a cycle. Import conditions now wrap the inlined sheet in `@layer`, `@supports` and `@media` blocks, and a commented-out import stays as written.

Extra defects:
- `lineContrast` painted a translucent fill twice when measuring the ground (sweep): fixed 1d71392e49, folded into the translucent-ground commit, so it isn't counted as extra.

No changesets: `packages/ui/src/testing` isn't in `@weasel-js/ui`'s exports, so no consumer can see these changes.

Checks:
- `packages/ui/src/testing/composeStory.test.tsx`: pass (4)
- `packages/ui/src/testing/selectRow.test.tsx`: pass (2)
- `packages/ui/src/testing/readModuleCss.test.ts`: pass (4)
- `packages/ui/src/testing/paintedContrast.browser.test.ts`: unrun (browser)
- Callers of the changed helpers, all pass:
  - Properties tests: a11y 14, noValue 7, kinds 9, header 7, readout 4, unit 11 and PropertyMetrics 19
  - `PlotDataPanel.test.tsx`: 6
  - `teardown.test.tsx`: 14
  - Component teardown suites: a-f 190, g-o 119, p-r 157, s 86 and t-z 64
- Unrun browser callers of `painted`/`lineContrast`: gloss, sunkenBox, rule, ContextMenuHost and Badge. If any of them passes a translucent ground, it will now throw and needs a `backdrop`; I didn't check the menu's glass background.
- `npm run checks:gate`: checks:gate: all 32 passed
- `npm run lint -w @weasel-js/ui`: fail, because ui has no `lint` script. `npx eslint packages/ui/src/testing/` stood in for it: pass, exit 0.
- `npm run check:changesets`: [changesets] OK — 3087 changeset(s).
- `npm run check:size`: sizes: no file or function grew past its cap.
- Tree clean.

tally: 12 of 12 fixed, 0 extra fixed