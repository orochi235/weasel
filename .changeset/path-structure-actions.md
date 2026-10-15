---
'@weasel-js/core': patch
---

Path edit gains actions for a path's structure, in the standard set and the `paths` preset:

- `setPathStart` (group `anchors`) makes the one selected anchor its subpath's start: a closed subpath turns to start there, and an open one reverses when given its last anchor.
- `reversePath` (group `path`) runs paths the other way without changing their shape. In path edit it reverses the subpaths holding the selected anchors, or every subpath, and the anchor selection follows its anchors; outside path edit it reverses every selected path in one undo step.
- `convertSegments` (group `anchors`, Shift+C) turns the selected segments — those whose two ends are selected anchors — between straight and curved: a line becomes a curve with handles at its thirds, drawing the same line, and a curve drops the two handles that shape it. `params.to` picks `'line'` or `'curve'`; with none it flips the lot. `convertSegmentAt` flips the segment under a Shift+double-click.
- `setAnchorField` writes a typed number into the selected anchors: `{ field, to }` sets every one, `{ field, by }` offsets each. `useAnchorFields()` reads the fields for chrome beside the canvas — the selected anchors' X and Y, `null` where they differ, and a lone anchor's handle X, Y, angle and length — and writes through that action.

The path-edit overlay draws an arrow at the middle of every segment, pointing the way the path runs, and a ring round each subpath's start anchor, under the chrome id `path-edit.direction` (`PATH_DIRECTION_CHROME_ID`). It is off by default; turn it on with `chromeVisibility={{ 'path-edit.direction': always }}`. `PathEditingOverlayStyle` takes `directionColor` and `directionSizePx`.

An anchor edit now carries a node's vertex colors, `data.vertexColors` and `data.stroke.vertexColors`, along with its `data.skin`: an anchor the edit keeps keeps its color, one it makes blends its neighbors', and reordering anchors reorders their colors.
