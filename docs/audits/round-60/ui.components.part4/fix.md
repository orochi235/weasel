fontFamilyOptions missing outline-only families (A): fixed 8a1838cd4a

FpsMeter averages per-frame rates, so it reads high when frame times vary (A): fixed e628f16732

InlineRange with `marks` and the default `fill` loses its track and fill (A): fixed 0b815a50b8

FloatingPanel's own control list misses contenteditable and role controls (A): fixed 0d957099be (it now uses gestures' `isInControlWithin` plus `[data-no-drag]`)

parseInline turns two globs on one line into emphasis (A): fixed 280193d4f7. This was a behavior call: a mark opens before punctuation only after a space or at the line's start, with a code span, shortcut, or escape right after the mark exempt. It is recorded in `docs/unruled.md` (604d07a3e3). The round-trip property test's generator now puts a space before a mark that opens on punctuation, because the syntax can no longer write that case.

Under the `'canvas'` policy, fontFamilyOptions labels a family that paints in its own face "not loaded", and building the list enrolls it (A): fixed e29be53e14 for the label, which now comes from what the resolver returned. The enrollment and the warnings are not a defect: the renderer resolves the same family the same way and enrolls it, and the warnings fire once per key.

FloatingPanel lays out in the container's content box but positions against its padding box (A): fixed b6d4082f82

Foundations Colors story never re-reads its values though its intro says the current side updates (A): fixed c74c548a6b. A MutationObserver now watches the theme's attributes on the page, and the intro is rewritten, since both columns force their own mode and neither is the "current" side. This story has no changeset.

A canceled pointer commits an InlineRange drag instead of canceling it (B): fixed aced955b0e. `lostpointercapture` is not added: the range never takes pointer capture itself.

`marks` with the default `fill` wipes out the track (B): duplicate of A's InlineRange `marks`/`fill` finding

FpsMeter overstates the frame rate on uneven frames (B): duplicate of A's FpsMeter finding

Input adornments take no pointer events, so a control placed in one can't be clicked (B): fixed 354b067cf0

A mark that opens before a code span closes inside it, splitting the span (B): fixed 822c24af30

A link URL with parentheses is cut at the first `)` (B): fixed 7b79693511

Foundations color table never re-reads its values (B): duplicate of A's Foundations finding

Extra: none. Commit 416560ff3b shortens six changeset titles from this round to under 140 characters so `check:changesets` passes.

Checks:
- `npx vitest run --maxWorkers=1`, each file one at a time, all pass:
  - useFloatingPlacement.test.tsx: 35 passed
  - fontFamilyOptions.test.tsx: 11 passed
  - Foundations.stories.test.tsx: 1 passed
  - fpsAverage.test.ts: 4 passed
  - parseInline.pbt.test.ts: 5 passed
  - parseInline.test.ts: 4 passed
  - InlineRange.edit.test.tsx: 12 passed
  - InlineRange.skin.test.tsx: 7 passed
- Also run, all pass, because they reach the changed code:
  - FloatingPanel.test.tsx: 13 passed
  - fontWeightOptions.test.tsx: 6 passed
  - InlineMarkdown.test.tsx: 11 passed
  - FpsMeter.test.tsx: 4 passed
  - PersistedFloatingPanel.test.tsx: 4 passed
  - ToolbarDock.float.test.tsx: 19 passed
  - ToolbarDock.test.tsx: 8 passed
- Not run, browser tests: `InlineRange/InlineRange.marks.browser.test.tsx`, `Input/Input.adornment.browser.test.tsx`
- `npm run checks:gate`: the first run failed on `check:changesets` (six titles over 140 characters). After the fix, `check:changesets`: OK, and the rerun of `npm run checks:gate`: EXIT 0.
- `npm run lint -w @weasel-js/ui`: the package has no lint script ("Missing script: lint"). Instead, eslint on every changed .ts/.tsx file: exit 0; `npm run typecheck:packages -- ui`: "1/1 ui ok"
- The tree is clean, with everything committed.

tally: 12 of 15 fixed, 0 extra fixed