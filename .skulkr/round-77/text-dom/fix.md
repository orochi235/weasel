- Lowering italic in an italic node takes the node-rewrite path (A): fixed 1e04cec32e. The test that used to assert this behavior was switched to an underline node.
- A CRLF split across two runs draws two lines in the overlay (B): fixed 8e789eb877 for `runsToDom`. The same split CRLF in `normalizeSmallCaps`'s rewrite path was fixed in b323717058.
- `runsToDom` and `normalizeSmallCaps` read `lang: ''` two ways (B): not a defect. The two readings differ, but `smallCapsPieces` gives the same pieces for every tested text under tr, az, lt and no locale, with every transform. Case mapping changes only letters that are capitals under either reading, so the first input rewrites nothing.
- A carried edit's font hold reads the node's stored runs (B): fixed 3c37f047b0.
- `restoreOverlayFocus` uses a bare `overlay.focus` instead of the scroller's `focus` (B): fixed aeeaee27bf. Moving the ref into `useSelectionStyling` to stay under `useTextEdit`'s 120-line function cap is 48119f4c19. The test checks only which focus path runs, because jsdom doesn't scroll on focus. The scroll jump itself is not reproduced here.
- The rich test harness reads and writes its node table through the prototype chain (B): fixed 405ee497b9. There's no changeset because `testing/` isn't exported.

Extra: the CRLF fix in `normalizeSmallCaps` (b323717058). It's the same defect in a second place in this area, so it isn't counted as an extra fix. e2259aa7a9 shortens two of my changeset titles under the 140-character cap.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `useTextEdit.rangeStyle` pass (18)
  - `domRuns` pass (86)
  - `domRuns.lang` pass (3)
  - `useTextEdit.fontHold` pass (5)
  - `overlaySelection` pass (2)
  - `testing/textEditHarness` pass (1)
  - `useTextEdit.chrome` pass (13)
  - `useTextEdit.container` pass (4)
- No browser test file was touched.
- `npm run checks:gate`: "all 33 passed"
- `npm run check:changesets`: OK, none of my changesets warns
- `npm run lint -w @weasel-js/text-dom`: the package has no `lint` script. Root `npm run lint` passes inside the gate.
- The tree is clean.

tally: 5 of 6 fixed, 0 extra fixed