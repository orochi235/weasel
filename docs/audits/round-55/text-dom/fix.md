onEnd moving focus re-enters through blur, writing a canceled edit or writing a commit twice (A): fixed 399793807d. The same hole on `startEdit` of another node is closed there too.

Clipped node's scroll box keeps catching presses after its pose goes null (A): fixed a4059b1932

Hidden clipping overlay's scroll box swallows presses (B): duplicate of the clipped-node scroll-box finding (A)

`place` reads the style the edit opened with after a restyle (A): fixed 6b1bae5ce9. `place` now reads the style the edit holds, and a restyle places the overlay again at once. This commit also holds the one-line form of 399793807d's `cancelEdit`, made to get `useTextEdit` back under `check:size`.

Overlay placed with the opening style, not the rewritten one (B): duplicate of the place-style finding (A)

Undo/redo with no readable present drops it from history (A): fixed 0f9619bc7d. The step is refused, as the finding suggested.

Plain-text paste keeps a lone CR that HTML paste turns into LF (A): fixed c087482166. Both paths now share one `toLineFeeds`.

`normalizeSmallCaps` drops a `<br>` inside a small-caps run span (B): fixed b59c019156. A `<br>` is now read as a line feed, both in `sourceText` and in `piecesMatch`. The "block boundary" part is not fixed, because a run span doesn't know whether text came before it in other runs.

Negative `startEdit` caret throws from the opening effect (B): fixed fdf39be345. The caret is clamped in `charOffsetToDomPosition`, and the docs now say so.

`restoreOverlayFocus` scrolls a clipped box back to its start (B): fixed 1464c1ce16. `OverlayScroll.focus` now also focuses with `preventScroll`. The test checks the option passed to `focus()`, since jsdom never scrolls.

Test harnesses use `in` on a user-keyed table (B): fixed 1188efcb8d. The harness's `getText` was fixed too. This only touches the test helpers, so it has no changeset.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1`, each touched file separately: `useTextEdit.session.test.ts` pass (10), `useTextEdit.rangeStyle.test.ts` pass (17), `editOverlay.test.ts` pass (1), `overlayPlace.test.ts` pass (1), `overlayHistory.test.ts` pass (2), `pasteRuns.test.ts` pass (10), `overlayOpen.test.ts` pass (3), `overlaySelection.test.ts` pass (1), `domRuns.test.ts` pass (82). Every other `useTextEdit.*.test.ts` file also passed. Not run: `overlayFocus.browser.test.ts` and `overlayScroll.browser.test.tsx`, which cover the `OverlayScroll.focus` change but are browser tests.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` (two titles over 140 characters) and `check:size` (`useTextEdit` at 133 lines). Both were fixed into their own commits, and the rerun passed.
- `npm run lint -w @weasel-js/text-dom`: not run, because the package has no `lint` script. Instead, `npx eslint packages/text-dom/src` exit 0.
- `npm run typecheck:packages -- text-dom`: "1/1 text-dom ok"
- Tree clean.

tally: 11 of 11 fixed, 0 extra fixed