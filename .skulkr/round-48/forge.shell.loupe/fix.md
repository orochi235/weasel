TODO 0 → 0: none of these findings was filed in `docs/TODO.md`, and this pass filed nothing new.

- Difference lens's captures kept in the shot map for the workshop's life (A): fixed b845fa00ec
- Replaced, cleared, or detached Pixels shot's ImageBitmap never closed (A): not a defect. `docs/unruled.md` already lists this as an open question ("whether a `LensCapture`'s bitmap stays valid after the source's next capture"). `capture()` hands the shot out to callers such as the Contrast readout and the Grid, which may still paint it later.
- Contrast readout over Pixels posts a capture on every reticle move (A): fixed 21e477bf61. It now waits through labkit's `useCaptureDelay`, which is newly exported from `@weasel-js/labkit/loupe` with a `minor` `api` changeset.
- Split lens's readouts find nothing once the seam is right of center (A): fixed 1279d79887. labkit's `Lens.less` now lifts the compared side's clip during the interior probe. The new test is in `readouts.browser.test.tsx` and is unrun here.
- Live copy keeps its host's old size after a resize under a still reticle (A): fixed b3d2f1c898, which compares the host size in the request. Also 3b44b1a2c7: a pane resize fires no window `resize`, so Live and Pixels lenses now watch their host with a `ResizeObserver`.
- Contrast readout's Pixels reading stays on the old DPR (A): fixed d1530bdf8d
- Compare menu gives two rows the same variant key (A): fixed 5ded60153b. Rows are keyed by option index. labkit config options are strings only, so the object-value case can't happen; the dotted-path collision could.
- `tokenChain` drops declarations written after a nested rule (A): fixed d92b369274
- Replaced or dropped Pixels shot's ImageBitmap never closed (B): duplicate of A's bitmap finding above
- 503 with a non-JSON body rejects `take` (B): fixed d77dc14637
- Pixels Contrast readout posts a capture on every move (B): duplicate of A's Contrast-capture finding
- Live and Pixels lenses never re-resolve when the OS color scheme flips (B): fixed 91f42ab5e3, in labkit's `useLensRemeasure`
- Compare-menu variant keys collide (B): duplicate of A's compare-menu finding
- Token chain cache ignores attribute and inline-style changes on the element or ancestors (B): fixed c0a55c817c. It also re-reads when a `<style>` in the body is rewritten.
- Live copy keeps its host's old size (B): duplicate of A's Live-copy finding
- Pixels Contrast reading not retaken when the lens's size or DPRs change (B): duplicate of A's DPR finding

Extra: none. Changeset titles over 140 characters were shortened in a97323238f.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pass for `liveSource.test.ts` (7), `trialAt.test.ts` (3), `capturePayload.test.ts` (15), `LiveCopies.test.tsx` (10), `captureClient.test.ts` (2), `CompareMenu.test.ts` (8), `readouts.test.tsx` (26), `tokenChain.test.ts` (3), `pixelsSource.test.ts` (9), `pixelsLens.density.test.ts` (1), and labkit's `useLensRemeasure.test.tsx` (1)
- Unrun: `packages/forge/src/shell/loupe/readouts.browser.test.tsx` (browser test)
- `npm run checks:gate`: fail on the first run (`check:changesets`: 7 titles over 140 characters). After a97323238f: `checks:gate: all 32 passed`
- `npm run lint -w @weasel-js/labkit`: pass, as step 27 of the gate. A separate run was refused by the controller hook.
- `npm run lint -w @weasel-js/forge`: not run, because forge has no `lint` script
- `npm run check:changesets`: `OK — 2242 changeset(s).`
- Tree clean

tally: 14 of 16 fixed, 0 extra fixed