Corner-snapped floating panel trails the pointer by the gap between its drop point and the corner (A): fixed 77b339eba7. The drag now starts from where the box actually sits. The existing drag tests had expected that 12px offset, so I corrected their numbers.

A backslash can't keep `<kbd>` literal (A): fixed ac077ff709. `\<` is now an escape. The property test now escapes `<` and generates it in its random text.

Empty ItemList drops its hold reason and puts `aria-label` on a div with no role (A): fixed cbb6d027f8. The empty state now goes through the same hold wrapper as the full list, and gets `role="group"` with the hold's `aria-disabled` and `aria-describedby`. I chose `group` because a list, listbox, or grid role with no items is itself invalid.

parseInline drops plain relative links like `guide.html` (B): fixed 273ed4fdc9. Only a link with a scheme other than http(s) or mailto is now refused. Leading control characters and spaces are refused too, since a browser strips them before reading the scheme.

Same-page `#fragment` links open in a new tab (B): fixed 57d2f08dc8. A `#id` link now opens in place; every other link still opens in a new tab, as the component's docstring promises.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - FloatingPanel `useFloatingPlacement.test.tsx` and `FloatingPanel.test.tsx`
  - InlineMarkdown `parseInline.test.ts`, `parseInline.pbt.test.ts` and `InlineMarkdown.test.tsx`
  - ItemList `ItemList.hold.test.tsx`, `ItemList.test.tsx` and `domItemList.test.tsx`
  - `HistoryList.test.tsx`
- Each new test failed before its fix.
- Unrun: `ItemList.removedFocus.browser.test.tsx` (browser).
- `npm run check:changesets`: pass ("OK — 6 changeset(s)").
- `npm run checks:gate`: pass ("all 32 passed").
- `npm run lint -w @weasel-js/ui`: there is no such script. eslint on the three changed component directories: pass.

tally: 5 of 5 fixed, 0 extra fixed