---
'@weasel-js/path-tools': patch
'@weasel-js/core': patch
---

Two path-tools presets for a path's structure, both in `pathTools`:

- `pathStructurePreset` brings `setPathStart` (group `anchors`), which makes the one selected anchor its subpath's start — a closed subpath turns to start there, and an open one reverses when given its last anchor — and `reversePath` (group `path`), which runs paths the other way without changing their shape. In path edit it reverses the subpaths holding the selected anchors, or every subpath, and the anchor selection follows its anchors; outside path edit it reverses every selected path in one undo step. It also draws an arrow at the middle of every segment of the open path, pointing the way it runs, and a ring round each subpath's start anchor, under the chrome id `path-edit.direction` (`PATH_DIRECTION_CHROME_ID`), off until chrome-caps shows it. `createPathStructurePreset(style)` takes their `color`, `arrowPx`, and `ringPx`.
- `segmentTypePreset` brings `convertSegments` (group `anchors`, Shift+C), which turns the selected segments — those whose two ends are selected anchors — between straight and curved: a line becomes a curve with handles at its thirds, drawing the same line, and a curve drops the two handles that shape it. `params.to` picks `'line'` or `'curve'`; with none it flips the lot. `convertSegmentAt` flips the segment under a Shift+double-click.

Core's `paths` preset gains `setAnchorField`, which writes a typed number into the selected anchors: `{ field, to }` sets every one, `{ field, by }` offsets each. `useAnchorFields()` reads the fields for chrome beside the canvas — the selected anchors' X and Y, `null` where they differ, and a lone anchor's handle X, Y, angle and length — and writes through that action. `segmentUnder` is exported for actions that act on the segment under the pointer in path edit.

An anchor edit now carries a node's vertex colors, `data.vertexColors` and `data.stroke.vertexColors`, and its stroke widths, `data.stroke.vertexWidths`, along with its `data.skin`: an anchor the edit keeps keeps its color and width, one it makes blends its neighbors' (each side of a two-sided width on its own), a deleted one's entry goes, and reordering anchors reorders them. Where an edit reverses a subpath, a two-sided width trades its `left` and `right`, so each edge stays on the side it was drawn on.
