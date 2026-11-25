Pasted table cell holding a `<p>` lands on its own line instead of after a tab (A+B): fixed fcb1d502d1

Window blur (switching app or tab) commits and closes the edit (A): fixed 9b76c1b7d8

Moving an edit to another container drops its undo history and armed style (A): fixed 73ee69cade; 638253bd0b is the follow-up type change this needed in `overlayTyping.ts`

`commitEdit()` while the container is `null` drops what was typed (B): fixed 9340c79054; 145262e2d7 folds the overlay-or-carry choice into one helper to stay under `check:size`

Undo back to the opened state of text ending in a break still writes a commit (A): fixed 2569ea7868

`startEdit` on another node while an edit is open discards that edit's changes (B): fixed 4f3ab1bee6. Nobody had ruled on this, so I made the call that `startEdit` commits the open edit first, as a click away does; `cancelEdit()` first discards it. It is recorded in `docs/unruled.md` under a new "Audit round seventy-five (2026-11-22): text-dom" section. The earlier test "writes nothing for an edit another startEdit closes, when onEnd moves focus" now expects exactly one commit, so the double write it guarded against is still covered.

`fontScale`, and numeric `fontSize` and `letterSpacing`, are rounded on every edit round trip (B): fixed 1ec750542a. The exact value is now kept in an attribute. The Chromium rounding part rests on the reviewer's inference; the test fakes Blink's six-digit output rather than measuring it.

Small caps' `capitalize` context skips overlay text outside a run span (B): fixed e1f8c579f7

`makeRichHarness` reads its id table through the prototype chain (B): not a defect. A function's `.text` and `.runs` read `undefined`, exactly as an unknown id does, so the result is `''` or `undefined` either way; my reproduction test passed without any fix, so I reverted it.

No extra defects found.

Checks:
- Each touched test file run alone with `--maxWorkers=1`: `pasteRuns`, `useTextEdit.chrome`, `useTextEdit.container`, `useTextEdit.session`, `useTextEdit.lifecycle`, `domRuns`, `overlayTyping` — all pass. I also ran neighbors that weren't touched (`useTextEdit.commit/draft/history/multiLine/pbt/shrunk/overlayStyle/rangeStyle`, `overlaySeed`, `overlayDraft.pbt`, `domRuns.*`, `text-tools/src/editor`, `diagram/src/edgeLabel`) — all pass.
- `npm run checks:gate`: the first run failed typecheck and typecheck:packages with TS2741 in `overlayTyping.test.ts`. After 638253bd0b: `checks:gate: all 33 passed`.
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/text-dom`: fails because the package has no `lint` script ("Missing script"). Instead I ran `npx eslint packages/text-dom/src`, which exits 0.
- No browser test files were touched.

tally: 8 of 9 fixed, 0 extra fixed