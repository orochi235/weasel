# Path operations

Every operation that changes a path's shape, grouped by the gesture that drives it. It exists so
operations sharing a gesture can later be stitched into one tool whose variants a modifier or a
setting picks, instead of a tool each. Update it in the same change that adds, renames, rebinds,
or removes one.

**Status:** *main* is merged; *landing* is adopted and on its way through its own branch;
*audition* is a lab on an unmerged branch (see the audition branches in `docs/TODO.md`), not yet
adopted. **Package:** *core* ships with `@weasel-js/core`'s `paths` preset; *path-tools* is in
`@weasel-js/path-tools`, registered by its family's preset (see that package's README).

**Tags:** every operation listed here carries the tag `path` and its section's tag, from
`PATH_GESTURE_TAGS` in `@weasel-js/core`, so `actionsTagged(actions, 'path-click')` gathers a
section. `pathOperationTags.test.ts` in `@weasel-js/path-tools` reads this file and fails when a
section's ids and its tag's actions disagree, so tag a new operation where it is listed.

## Drag on a path's own parts (path edit)

Tag: `path-drag`

| Operation | Action id | What the drag does | Default binding | Status | Package |
|---|---|---|---|---|---|
| Edit anchors | `editAnchors` | Moves anchors and handles | Drag on an anchor or handle | main | core |
| Bend segment | `bendSegment` | Reshapes a segment by its middle; on a spiro curve, with `spiroPreset` on, adds a smooth point there and drags it | Drag on a segment | main | core |
| Marquee-select anchors | `marqueeAnchors` | Selects anchors in a box | Drag on empty canvas | main | core |
| Handle locks | `handleLock.angle`, `handleLock.length` | Hold a handle's angle or length during a drag | Toggles; Mod while dragging holds length | main | path-tools |
| Balance handles | `balanceHandles` | Scales a segment's two handles together from a grip on its balance line; a length lock holds it still | Drag a balance grip, shown under `path-edit.balance` | main | path-tools |
| Path constraints | `constrainAnchors`, `unconstrainAnchors` | Keep geometric relations (parallel, level, fixed) during any anchor drag | C / Shift+C in its lab only | main | path-tools |
| Link anchor | `linkAnchor` | Moves an anchor, and released on another shape's anchor or segment ties it there with a constraint link, which every later edit or whole-shape transform of either keeps | Alt-drag an anchor, under `constraintsPreset` | main | path-tools |
| Corner shape | `editCorner` | Sets a corner anchor's radius, or every selected corner's, from the widget inside it | Drag a corner widget, shown under `path-edit.corners` | main | path-tools |
| Path snapping | — | Locks a dragged anchor to other shapes' anchors, crossings, tangent and perpendicular points, midpoints, extremes, and strokes, and to the parts of its own path the drag leaves still; the pen, the insert tools, and a move snap the same way | Any anchor drag: other shapes' anchors by default, every kind with a `pathSnapSource` in `<SceneCanvas snap>` | main | core |
| Soft selection | — | Moves nearby anchors with falling weight; the wheel scrubs the radius mid-drag | Any anchor drag, under `createSoftSelectionPreset` | landing | path-tools |
| Handle snap | — | Snaps a handle's angle to steps and to its partner | Any handle drag, under `createHandleSnapPreset` | landing | path-tools |
| Lengthen | `lengthenPath` | Grows an open end along its tangent or curvature, or trims it back along itself | Drag an end anchor with the Lengthen path-edit tool on | main | path-tools |

## Click on a path

Tag: `path-click`

| Operation | Action id | What the click does | Default binding | Status | Package |
|---|---|---|---|---|---|
| Select anchor | `selectAnchor` | Selects an anchor | Click | main | core |
| Insert anchor | `insertPathAnchor` | Adds an anchor on the segment | Alt+click | main | core |
| Cut path at anchor | `cutPathAtAnchor` | Opens the path there | Alt+Shift+click | main | core |
| Equalize handles | `equalizeHandles` | Gives a segment's two handles one proportion of the way to their corner | Double-click a balance grip | main | path-tools |
| Trim segment | `trimPath` | Removes the piece between the nearest crossings | Click with the Trim tool (Y) | main | path-tools |
| Extend to next path | `extendToMeet` | Carries an open end to the next stroke | Click with the Extend tool (U) | main | path-tools |
| Convert segment | `convertSegmentAt` | Flips the segment between straight and curved | Shift+double-click in path edit | main | path-tools |
| Slice | `slice` | Cuts shapes along a drawn line | Slice tool (K) | main | core |

## Brush strokes over a path

Tag: `path-brush`

| Operation | Action id | What the brush does | Default binding | Status | Package |
|---|---|---|---|---|---|
| Simplify brush | `simplifyBrush` | Removes anchors it passes over, refitting the curve | Drag with the brush | main | path-tools |
| Smudge brush | `smudgeBrush` | Pushes the outline along with the pointer | Drag with the Smudge tool (S) | main | path-tools |
| Puppet warp | `puppet.drag`, `puppet.addPin`, `puppet.removePin` | Pins the path and bends it when a pin is dragged | Puppet warp tool (B): click pins, Alt+click a pin takes it out, drag a pin bends | main | path-tools |

## Handles on the box around a selection

Tag: `path-box`

| Operation | Action id | What the handles do | Default binding | Status | Package |
|---|---|---|---|---|---|
| Perspective and free distort | `distort.drag` | Corner pins warp the selected paths | Drag a corner with the Distort tool (F) | main | path-tools |
| Envelope mesh (to be renamed Cloth warp) | `envelope.drag` | A grid of control points warps the selection | Drag a mesh point with the Envelope tool (C) | main | path-tools |

## Commands on the selection

Tag: `path-command`

| Operation | Action id | What it does | Default binding | Status | Package |
|---|---|---|---|---|---|
| Join | `joinPaths` | Joins two open ends with a straight segment | Mod+J | main | core |
| Join anchors | `joinAnchors` | The same, from two selected end anchors | Mod+J in path edit | main | core |
| Bridge | `bridgePaths` | Joins two open ends with a curve along each end's heading | Alt+J | main | path-tools |
| Bridge anchors | `bridgeAnchors` | The same, from two selected end anchors | Alt+J in path edit | main | path-tools |
| Average anchors | `averageAnchors` | Moves selected anchors to their mean, or lines them up on one axis | Mod+Alt+Shift+J | main | core |
| Cut at crossings | `snipAtCrossings` | Splits paths where they cross | — | main | core |
| Simplify | `simplifyPath` | Removes anchors the curve does not need | — | main | core |
| Offset path | `offsetPath` | Grows or shrinks the outline by a distance | — | main | core |
| Segment type | `convertSegments` | Turns selected segments straight or curved, or flips them | Shift+C in path edit | main | path-tools |
| Make start point | `setPathStart` | Makes the selected anchor its subpath's start | — | main | path-tools |
| Reverse path direction | `reversePath` | Runs the edited subpaths, or the selected paths, the other way | — | main | path-tools |
| Anchor fields | `setAnchorField` | Moves the selected anchors, or a lone anchor's handle, to a typed number | Typed into `<AnchorFields>` | main | core |
| Retract handles | `retractHandles` | Collapses selected anchors' handles | — | main | core |
| Make handles symmetric | `makeHandlesSymmetric` | Equal length, opposite direction | — | main | core |
| Delete anchors | `deleteAnchors` | Removes selected anchors | Delete | main | core |
| Set corners | `setCorners` | Gives the selected corners a `corner-shape` keyword or `superellipse()` parameter, a radius, or both | — (the corner controls panel) | main | path-tools |
| Next corner shape | `cycleCornerShape` | Steps the selected corners to the next `corner-shape` keyword | K in its lab only | main | path-tools |
| Harmonize curvature | `harmonizeAnchors` | Rescales a smooth anchor's handles so curvature is continuous | H in its lab only | main | path-tools |
| Resample | `resamplePath` | Spreads anchors evenly by arc length, to a count or a spacing, holding corners | — | main | path-tools |
| Add extremes | `addExtremeAnchors` | Adds anchors at each curve's leftmost, rightmost, top, and bottom, on segments with both ends selected, or the whole path while none is | Alt+X in path edit | main | path-tools |
| Grow, shrink, and every-Nth selection | `growAnchorSelection`, `shrinkAnchorSelection`, `selectEveryNthAnchor`, `selectCornerAnchors`, `selectSmoothAnchors`, `invertAnchorSelection` | Selects anchors along the path: one further each way, one fewer, every Nth, the corners, the smooth ones, or the rest | ] / [, Alt+N, Alt+C, Alt+M, Alt+I in path edit | main | path-tools |
| Blend | `blend` | Live steps between two shapes | — | main | path-tools |
| Bend along a path | `bendAlong` | Lays a shape along a spine | — | main | path-tools |
| Repeat along a path | `repeatAlong` | Live copies placed along a path | — | main | path-tools |
| Text along a path | `textAlong` | Lays a text's glyphs along another shape's outline, hiding both sources | Alt+Shift+X | main | path-tools |
| Expand warp | `expandWarp` | Drops a held distort, envelope, or puppet warp, keeping its geometry | — | main | path-tools |
| Warp settings | `configureWarp` | Remakes a held warp with new settings | — | main | path-tools |
| Spiro point kind | `setSpiroKind` | Makes the selected spiro points smooth, corner, or tangent to a line on either side, and solves the curve again | — | main | path-tools |
| Convert spiro to path | `releaseSpiro` | Drops a spiro curve's points, keeping the curve as an ordinary path | — | main | path-tools |

## Gestures shared today

Places where one gesture already reaches several operations, which a variant set would make
explicit:

- **A drag on an anchor or handle** runs `editAnchors`, with handle locks, constraints, path snapping,
  soft selection and handle snap all shaping the same drag; with Alt held at the press, `linkAnchor`
  runs that same drag and links the anchor where it lands.
- **A click on a stroke** trims or extends depending on the tool held; Insert and Cut add a
  modifier to the same click.
- **A brush drag** simplifies or smudges depending on the tool.
- **Mod+J** joins, Alt+J bridges, and Mod+Alt+Shift+J averages, in both the path and anchor
  forms.
