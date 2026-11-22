- Zoom-in key ignores Cmd+Shift+= / Cmd++ (A): fixed d94a950670
- Pinch zoom doesn't stop a running pan coast (A+B): fixed fb7ec11f3d
- Keyboard context menu swallows the key when nothing opens (A): fixed c7dee88021
- Right-click changes the selection even when no menu opens (A): fixed 18b006e812
- Slice pieces get inserted in reverse order (A): fixed 17f2ab1079
- Wheel over a container scrolled past its range jumps the content (A): fixed 68f2130316
- `resetMs` doc says Cmd+0 only, but the code also times Fit Content (A): fixed 481f292488 (the doc now says both; no changeset, since it's a doc comment only)
- Pinch doesn't stop the coast (B): duplicate of the A pinch finding, fb7ec11f3d
- Wheel pan and wheel/trackpad/key zoom leave the coast running (B): fixed bd770e566b
- Container scroll takes a wheel that lands on a node painted over it (B): fixed 247f55fbc4. This was a behavior call, made strict and recorded in `docs/unruled.md`: with `hitAt` wired, only the containers holding the topmost node scroll, and with none the wheel pans the view. `scrollableAt` gained an optional `top` argument, so its changeset is `minor`.
- Context-menu hit reports `selected-body` for an unselected hit with no id (B): fixed 207aedf290
- [r42-1] Nested scroll container hit-tested where its parent's clip hides it (carried): not a defect (no longer applies). `scrollablesAt` only goes into a container's children where its own clip contains the point.
- [r42-2] `segmentUnder` tests the plane-world path, the affordance the camera one (carried): not a defect (no longer applies). Every caller wraps `segmentUnder` in `inPlane`, which carries the point and the view's scale into the plane, so both tests cover the same region.
- [r42-3] A new drag-pan doesn't stop the last coast (carried): not a defect (no longer applies). `start` already calls `view.stopDecay?.()`.
- [r42-4] `buildToolActivateBindings` gives a third spec a duplicate id (carried): not a defect (no longer applies). The numbered-suffix loop keeps the ids unique.
- [r42-5] Fit Content ignores `axis` (carried): not a defect (no longer applies). `holdFitToAxis` handles it.
- [r42-6] `container.scroll` drops the z offset (carried): not a defect (no longer applies). It now spreads `...from`.
- [r42-7] `container.scroll` moves a scaled container's content in world units (carried): not a defect (no longer applies). `worldPerScrollUnit` converts it.

Extra defects: none. Two follow-up commits fix things in this work: a9-style changeset fixes (three titles cut to the 140-character limit, and the `scrollableAt` changeset raised to `minor`) and typing for two new tests that typecheck rejected.

Checks:
- Each touched test file, run one at a time: sliceOps, touchZoom, viewportWheelPan, viewportZoom, contextMenu, contextMenu.sceneFree, containerScroll, plus viewportZoom.fit, zoomAxis, wheelConvention and viewportDragPan: all pass.
- `npm run checks:gate`: first run "1 of 33 failed" (typecheck, in the two new tests). After the fix: "checks:gate: all 33 passed".
- `npm run check:changesets`: "OK — 459 changeset(s)".
- `npm run lint -w @weasel-js/core`: core has no lint script, so there is nothing to run. The gate's root `npm run lint` passed.
- Tree is clean apart from `.skulkr/`.

tally: 11 of 18 fixed, 0 extra fixed