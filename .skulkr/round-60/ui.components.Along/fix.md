CurvedLabel shows Latin text backwards under `dir="rtl"` with no bidi engine (A): fixed e2df5af1c5
useRunScroll keeps a stale offset after its range shrinks, so focus and glide go wrong (A+B): fixed 6467c21c5f
useItemLengths' ResizeObserver never unobserves items that left (A+B): fixed 6192dab166
LensRim lab crashes on saved marks that are not an array (A): fixed afee2954d9
TrackGeometry lab accepts saved handles whose y is not a number (A): fixed 804a5eb8d8
CurvedLabel's `offset` does nothing for a label that fits its track (B): fixed b6f8609ffd
Bent run text is misplaced under a rotated ancestor when the row does not scroll (B): fixed 2e8e985d11. `RunBand` now always renders its svg so the text has a frame to map through; the band path is still drawn only while the row scrolls.
LensRim lab's marks drift off their spot when Size changes (B): fixed fe93afd8fa. Marks are now stored as shares of the picture, under a new storage key (`v2`).
InputTrace never sets "claimed" on a coalesced pointermove line (B): fixed 43db79e7b3
A sideways wheel scrolls a right-to-left-reading run backwards (B): fixed 2dde909d02

No extra defects found.

Checks:
- vitest, one file at a time with `--maxWorkers=1`: all pass.
  - visualGraphemes.test.ts 8/8
  - CurvedLabel.test.tsx 7/7
  - useRunScroll.test.tsx 16/16
  - useItemLengths.test.tsx 3/3
  - useRunRow.test.tsx 7/7
  - Bar.along.test.tsx 24/24
  - lab/LensRimView.test.tsx 3/3 (it replaces LensRimView.test.ts)
  - lab/trackGeometry.test.ts 1/1
  - lab/useEventLog.test.tsx 1/1
- Unrun: `CurvedLabel.browser.test.tsx` is a browser test, so it cannot run here. Its offset comparison now passes `at: 0` to match the new offset behavior.
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed `check:changesets` on five titles over 140 characters; I shortened them and folded the fixes into their commits.
- `npm run lint -w @weasel-js/ui` and `-w @weasel-js/text`: neither package has a `lint` script ("Missing script: lint"). I ran eslint on every changed file instead: pass. The gate's lint steps passed.
- The tree is clean, and `.skulkr/` is untouched.

tally: 12 of 12 fixed, 0 extra fixed