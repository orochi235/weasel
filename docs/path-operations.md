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
| Bend segment | `bendSegment` | Reshapes a segment by its middle | Drag on a segment | main | core |
| Marquee-select anchors | `marqueeAnchors` | Selects anchors in a box | Drag on empty canvas | main | core |
| Handle locks | `handleLock.angle`, `handleLock.length` | Hold a handle's angle or length during a drag | Toggles; Mod while dragging holds length | main | path-tools |
| Balance handles | `balanceHandles` | Scales a segment's two handles together from a grip on its balance line; a length lock holds it still | Drag a balance grip, shown under `path-edit.balance` | main | path-tools |
| Path constraints | `constrainAnchors`, `unconstrainAnchors` | Keep geometric relations (parallel, level, fixed) during any anchor drag | C / Shift+C in its lab only | main | path-tools |
| Path snapping | — | Locks a dragged anchor to other shapes' anchors, crossings, tangent and perpendicular points, midpoints, extremes, and strokes, and to the parts of its own path the drag leaves still; the pen, the insert tools, and a move snap the same way | Any anchor drag, while `toolOptions.pathSnap` is set | main | core |
| Soft selection | — | Moves nearby anchors with falling weight | Drag an anchor | audition | — |
| Handle snap | — | Snaps a handle's angle to steps and to its partner | Drag a handle | audition | — |
| Lengthen | — | Grows an open end along its tangent or curvature | Drag an end anchor | audition | — |
| Corner shape | — | Rounds, chamfers, or scoops a corner anchor | Drag a corner widget | audition | — |

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
| Bridge | `bridgePaths` | Joins two open ends with a curve along each end's heading | Mod+Shift+J | main | path-tools |
| Bridge anchors | `bridgeAnchors` | The same, from two selected end anchors | Mod+Shift+J in path edit | main | path-tools |
| Average anchors | `averageAnchors` | Moves selected anchors to their mean, or lines them up on one axis | Mod+Alt+J | main | core |
| Cut at crossings | `snipAtCrossings` | Splits paths where they cross | — | main | core |
| Simplify | `simplifyPath` | Removes anchors the curve does not need | — | main | core |
| Offset path | `offsetPath` | Grows or shrinks the outline by a distance | — | main | core |
| Retract handles | `retractHandles` | Collapses selected anchors' handles | — | main | core |
| Make handles symmetric | `makeHandlesSymmetric` | Equal length, opposite direction | — | main | core |
| Delete anchors | `deleteAnchors` | Removes selected anchors | Delete | main | core |
| Harmonize curvature | `harmonizeAnchors` | Rescales a smooth anchor's handles so curvature is continuous | H in its lab only | main | path-tools |
| Resample | `resamplePath` | Spreads anchors evenly by arc length, to a count or a spacing, holding corners | — | main | path-tools |
| Add extremes | `addExtremeAnchors` | Adds anchors at each curve's leftmost, rightmost, top, and bottom, on segments with both ends selected, or the whole path while none is | Alt+X in path edit | main | path-tools |
| Grow, shrink, and every-Nth selection | `growAnchorSelection`, `shrinkAnchorSelection`, `selectEveryNthAnchor`, `selectCornerAnchors`, `selectSmoothAnchors`, `invertAnchorSelection` | Selects anchors along the path: one further each way, one fewer, every Nth, the corners, the smooth ones, or the rest | ] / [, Alt+N, Alt+C, Alt+M, Alt+I in path edit | main | path-tools |
| Blend | `blend` | Live steps between two shapes | — | main | path-tools |
| Bend along a path | `bendAlong` | Lays a shape along a spine | — | main | path-tools |
| Repeat along a path | `repeatAlong` | Live copies placed along a path | — | main | path-tools |
| Expand warp | `expandWarp` | Drops a held distort, envelope, or puppet warp, keeping its geometry | — | main | path-tools |
| Warp settings | `configureWarp` | Remakes a held warp with new settings | — | main | path-tools |
| Segment type | — | Turns selected segments straight or curved | — | audition | — |
| Path start and direction | — | Sets where a subpath starts and which way it runs | — | audition | — |

## Gestures shared today

Places where one gesture already reaches several operations, which a variant set would make
explicit:

- **A drag on an anchor or handle** runs `editAnchors`, with handle locks, constraints, path snapping,
  and (in audition) soft selection and handle snap all shaping the same drag.
- **A click on a stroke** trims or extends depending on the tool held; Insert and Cut add a
  modifier to the same click.
- **A brush drag** simplifies or smudges depending on the tool.
- **Mod+J** joins, Mod+Shift+J bridges, and Mod+Alt+J averages, in both the path and anchor
  forms.
