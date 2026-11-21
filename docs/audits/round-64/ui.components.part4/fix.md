- InlineRange Escape mid-drag also closes the dialog or popover it sits in (A): fixed 9e799396cc
- InlineRange made disabled or read-only mid-drag still commits on release or blur (A): fixed 4f2da4e93e
- iconFromData throws in development on a BigInt or a cyclic value (A): fixed d97f61ea71
- ItemList `empty={null}` draws `—` but measures an empty string (A): fixed 029c8fe817
- useFloatingPlacement shows the dropped spot again when `placement` comes back to the object the drag started from (A): fixed 8983e7f992
- InlineRange accent fill is laid over the padding box, so its edge misses the thumb (B): fixed 392d5cee88 (the browser test `InlineRange.marks.browser.test.tsx` is unrun here)
- Held InlineRange makes React warn of a controlled value with no onChange (B): fixed 2ced87f5fc
- `***x***` parses as bold `*x` and a stray asterisk (B): fixed 50202c6680
- Lines foundation story puts a third child in a two-column grid, so each caption wraps under its token (B): fixed bbfe80dbbf (a story's CSS layout, so no jsdom test can reproduce it; no changeset because it is story-only)

No extra defects found.

Checks:
- Each touched test file, run alone with `--maxWorkers=1`: pass. That covers InlineRange.edit (15), InlineRange (12), InlineRange.skin (7), domItemList (1), useFloatingPlacement (36), parseInline (5), parseInline.pbt (5), and resolveIcon (7). Each new test was also seen failing against the unfixed code.
- InlineRange.marks.browser.test.tsx: unrun (browser).
- `npm run check:changesets`: pass ("OK — 3438 changeset(s)")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/ui`: the package has no `lint` script ("Missing script: lint"). eslint on the six changed component directories: pass. The gate's root `npm run lint`: pass.

tally: 9 of 9 fixed, 0 extra fixed