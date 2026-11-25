- Keyless cell keyed by its index after `false`/`null` slots are dropped, so a conditional child remounts the cells after it (A+B): fixed b68d4a7591
- A key repeated across arrays or fragments gives two cells one item key (A): fixed b68d4a7591. This needed a behavior call, so I made the strict one and recorded it in `docs/unruled.md`: the first child keeps the key, and the later one is keyed by its place, warns, and is not a reorder unit.
- Keyed `Bar.Group` is never marked as a reorder unit (A): fixed 61e532fc59
- Menu-overflow bar doesn't re-measure when its lead appears or leaves (A+B): fixed 8848519f73
- `useMenuLeast` gives a wrong `least` in right-to-left layout (A+B): fixed 4cd317f2df
- Framed vertical bar doesn't scroll (A): fixed 1ca8ea5b76. Its test is in `Bar.vertical.browser.test.tsx` and is unrun here.
- `BarMenu` ignores the bar's disabled or read-only hold (B): fixed bcd82a389d. Part of the claim was wrong: `ButtonTooltip` already refused presses in a disabled scope. What was real: `defaultOpen` still opened the menu in a disabled bar, and a read-only bar's flag and choice rows still wrote. Read-only rows now write through a no-op, because leaving `onChange` out drops them from the menu entirely.
- Disabled compound leaf's popover still opens (B): fixed d90ef7e56b
- `least` shrinks to the lead alone when the first item is a spacer (B): fixed 67c7a27428
- Bar stories use classes the stylesheet no longer defines (B): fixed a12dbe7ff9. This is stories only, so it has no changeset. The new `stories.classes.test.ts` checks that every class a story in the folder reads is defined in its stylesheet.

No extra defects found.

Checks:
- Test files, one at a time with `--maxWorkers=1`: `barItems.test.tsx` 4 passed, `useMenuLeast.test.tsx` 2 passed, `Bar.natural.test.tsx` 3 passed, `Bar.least.test.tsx` 1 passed, `renderBarLeaf.test.tsx` 13 passed, `BarMenu.test.tsx` 8 passed, `stories.classes.test.ts` 1 passed. Bar's other jsdom files and the PrefsBar files also passed after the key change.
- Unrun: `Bar.vertical.browser.test.tsx` (browser).
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` on three titles over 140 characters; I shortened them and squashed each into its fix's commit.
- `npm run lint -w @weasel-js/ui`: fails, because the package has no `lint` script. In its place, `npx eslint` on every changed .ts/.tsx file exited 0.
- `npm run check:size`: "sizes: no file or function grew past its cap."
- The tree is clean.

tally: 13 of 13 fixed, 0 extra fixed