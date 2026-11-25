viewport.zoom with no params zooms about the canvas origin, unanimated and unrecorded (A): fixed 5e3327b9cc

container.scroll ignores the wheel-pan axis lock (A): not a defect. `pan: { axis }` is a lock on the viewport pan alone. A container inside a pan-locked view, such as a vertically scrolling track list in an x-locked timeline, still scrolls along its own axes. Nothing documents the lock as covering container scroll.

Context menu `bodyKind` differs between a right-click on a selected shape and Shift+F10 (A): fixed d7679ba074. Both now name the kind every selected shape shares, and none for a mixed selection. This is my call, recorded in `docs/unruled.md` under "Audit round seventy-two (2026-11-22): default actions".

copyOps inserts a copy under its source's locked parent, so the insert is refused (B): not a defect. `isLocked` climbs, so a child of a locked group is itself locked. The scene's selection never holds a locked node (`LockGuard.reachable`), so duplicate and clone never pass such an id to copyOps.

tool.resetToDefault reports enabled with no `activeTool` dep, so Escape is swallowed by a no-op (B): fixed c57c78db5d. The same fix went into `tool.activate`.

viewport.zoom's param-less fallback zooms about the origin while Cmd+= zooms about the host center (B): duplicate of A's viewport.zoom finding, fixed in 5e3327b9cc.

Context-menu `enabled` probes the menu at the pointer while a keyboard `run` opens it at the selection (B): not a defect. The dispatcher's `worldPointOf` gives a key event no point, so `enabled` and `run` both take the selection path for a key.

[r42-1] containerScroll hit-tests a nested container its parent clips out of view (carried): not a defect (no longer applies). `scrollablesAt` visits children only where the parent's own clip contains the point.

[r42-2] segmentUnder tests the plane-world path rather than the camera-projected one (carried): not a defect (no longer applies). Both callers, insertPathAnchor and bendSegment, are wrapped in `inPlane`, which maps the point into the edited layer's plane.

[r42-3] A new drag-pan does not stop the previous drag's inertia coast (carried): not a defect (no longer applies). `start` calls `view.stopDecay()`.

[r42-4] buildToolActivateBindings mints the same binding id twice for a third spec of one tool on one key (carried): not a defect (no longer applies). A counter loop now keeps every id unique.

[r42-5] Fit Content ignores `axis` (carried): not a defect (no longer applies). `holdFitToAxis` keeps the fit to the axis.

[r42-6] container.scroll drops a container's z scroll offset (carried): not a defect (no longer applies). The new offset spreads `...from`, so z is kept.

[r42-7] container.scroll moves a scaled container's content by world units (carried): not a defect (no longer applies). `worldPerScrollUnit` converts the step into the container's own units.

Extra: viewport.wheelPan and viewport.zoom reported enabled with no `view` dep, then did nothing, so the wheel or a zoom key was swallowed (sweep, the same mistake as B's tool.resetToDefault finding): fixed dcf327bf0d

Checks:
- Test files touched, one at a time with `--maxWorkers=1`: viewportZoom.test.ts pass (47), toolActivate.test.ts pass (15), toolResetToDefault.test.ts pass (3), contextMenu.test.ts pass (14), viewportWheelPan.test.ts pass (17).
- Related test files: pass, 26 files (context-menu, tool-key and viewport integration suites in core, editing, ui, hud, labkit, devtools and routing).
- `npm run checks:gate`: pass, "checks:gate: all 33 passed".
- `npm run check:changesets`: pass, "OK — 550 changeset(s)".
- `npm run lint -w @weasel-js/core`: not run, because core has no lint script. eslint on the changed files instead: pass, exit 0.

tally: 3 of 14 fixed, 1 extra fixed