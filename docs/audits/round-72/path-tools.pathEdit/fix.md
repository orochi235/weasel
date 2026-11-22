Canceled anchor drag keeps the selection its press made (A): fixed 5735c29020

Segment bend dragged back to its press point still commits (A): fixed 59279c7f15

Typed anchor X/Y and handle fields ignore `pathSymmetry` (A): fixed 56d1d0be68. geom's `writeAnchorField` now takes the symmetries, and a new `translateEachSymmetric` moves each anchor by its own delta.

Double-click on an unselected non-path body opens a selected path (A): fixed b1c10dea6f. This was a behavior call, recorded in `docs/unruled.md` (2022751553). An old test line had asserted the previous fallback; I changed it.

`leavePathEdit` is always enabled and takes Escape with no path open (A): fixed 9b0d9626cd. This adds `modeDefaultToReturnTo` to routing, so the `enabled` check and `returnToModeDefault` use the same logic.

Segment bend ignores `pathSymmetry` (B): fixed e7b2d77139. This adds `bendSegmentSymmetric` to geom. For handle-less anchors the symmetry pairing can't tell whether a mirror flips sides, so the side comes from how the transform maps the segment's two ends. On a segment the mirror maps onto itself, each handle takes the mean of its targets; that call is recorded in `docs/unruled.md`.

Anchor drag snap offers targets on symmetric images and weighted followers (B): fixed fee4c8f79f

Canceling an anchor drag keeps the press's selection (B): duplicate of the first finding (A), fixed 5735c29020

Segment bend commits a history entry when the frame is unchanged (B): duplicate of the second finding (A), fixed 59279c7f15. Skipping a zero bend also covers the opposite handle `alignedOpposite` would have snapped.

Extra: none. 68276291b2 (shorter changeset titles) and f1d584a1ae (moved the anchor drag's snap into `editAnchors/dragSnap.ts` to pass `check:size`) only fix this pass's own check failures; they aren't separate defects.

Checks:
- Each touched test file, one at a time with `--maxWorkers=1`: pass (`anchorSymmetry`, `bendSegment`, `editAnchors.pathSnap`, `editAnchors.symmetry`, `editAnchors`, `enterPathEdit`, `leavePathEdit`). Also pass: geom's `anchorFields` and path-tools' `anchorFields`, plus the related editing, devtools, routing and draw tests that reference `enterPathEdit` or `leavePathEdit`. No browser tests were touched.
- `npm run checks:gate`: first run "checks:gate: 2 of 33 failed" (`check:changesets` titles, `check:size`); after the fixes, "checks:gate: all 33 passed".
- `npm run lint -w` for path-tools, geom and routing: none of the three has a `lint` script ("Missing script: lint"). I ran eslint on every changed file instead: pass, exit 0.
- Tree clean.

tally: 9 of 9 fixed, 0 extra fixed