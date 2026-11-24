I fixed all seven findings in `ui.components.part8` with seven commits; no carried findings were given. Two of the browser tests can't run on this node.

- Switch `aria-checked="mixed"` is invalid on role `switch` (A): fixed 997d0e59c2. While `indeterminate`, the input takes role `checkbox` with `aria-checked="mixed"`. I made this call without a ruling and recorded it in `docs/unruled.md`.
- An indeterminate Switch that is also `isSelected` turns off on click, and the CSS draws the mixed and selected states at once (A): fixed 54df50e914. A click while indeterminate now reports `true`, and the mixed thumb is drawn in the plain foreground color instead of the selected one.
- Forced colors leave an indeterminate Switch's track in a theme color (B): fixed 3c8b800f4c. The same sweep found that a hovered switch's border also kept a theme color under forced colors, and it now uses `Highlight`. Its test is in `forcedColors.browser.test.tsx` and is unrun here.
- An untitled SidebarPanel spreads its actions and close button apart, starting at the leading edge (A): fixed 433c23fe6f. The header row now uses `justify-content: flex-end`. Its test, `SidebarPanel.browser.test.tsx`, is new and unrun here.
- useSpanSeek's hold gets stuck when `onSeek` goes away mid-drag (A): fixed 3c9ec7f7a6.
- A span's `ink` is ignored on the unfilled label of an open segment (A): fixed 98f7bd43d7. The CSS does this on purpose and its comment explains why, so I changed the prop's doc instead. Since only the doc changed, there is no test and no changeset.
- SwatchRings throws on `columns={0}` (B): fixed 782bf9eca6. The ring path now reads `columns` through ui-input's `wholeColumns`, which the flat grid already used. That also fixes fractional values like 2.5, which crashed in the same place.

Checks run:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Switch/Switch.test.tsx`: pass (7/7)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SpanStrip/SpanStrip.test.tsx`: pass (24/24)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SwatchGrid/SwatchGrid.along.test.tsx`: pass (22/22)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/SidebarPanel/SidebarPanel.test.tsx`: pass (14/14)
- `packages/ui/src/forcedColors.browser.test.tsx`: unrun (browser)
- `packages/ui/src/components/SidebarPanel/SidebarPanel.browser.test.tsx`: unrun (browser)
- `npm run checks:gate`: pass (33/33, exit 0)
- `npm run lint -w @weasel-js/ui`: the package has no `lint` script. Instead, `npx eslint` on every changed directory and file passed, and `npm run typecheck:packages -- ui` passed ("1/1 ui ok").
- The tree is clean.

tally: 7 of 7 fixed, 0 extra fixed