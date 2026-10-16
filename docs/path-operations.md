# Path operations

Every operation that changes a path's shape, grouped by the gesture that drives it. It exists so
operations sharing a gesture can later be stitched into one tool whose variants a modifier or a
setting picks, instead of a tool each. Update it in the same change that adds, renames, rebinds,
or removes one.

**Status:** *main* is merged; *landing* is adopted and on its way through its own branch;
*audition* is a lab on an unmerged branch (see the audition branches in `docs/TODO.md`), not yet
adopted.

## Drag on a path's own parts (path edit)

| Operation | Action id | What the drag does | Default binding | Status |
|---|---|---|---|---|
| Edit anchors | `editAnchors` | Moves anchors and handles | Drag on an anchor or handle | main |
| Bend segment | `bendSegment` | Reshapes a segment by its middle | Drag on a segment | main |
| Marquee-select anchors | `marqueeAnchors` | Selects anchors in a box | Drag on empty canvas | main |
| Handle locks | `handleLock.angle`, `handleLock.length` | Hold a handle's angle or length during a drag | Toggles; Mod while dragging holds length | main |
| Balance handles | — | Scales a segment's two handles together from a grip on its balance line | Drag the grip | landing |
| Path constraints | `constrainAnchors`, `unconstrainAnchors` | Keep geometric relations (parallel, level, fixed) during any anchor drag | C / Shift+C in its lab only | landing |
| Soft selection | — | Moves nearby anchors with falling weight | Drag an anchor | audition |
| Handle snap | — | Snaps a handle's angle to steps and to its partner | Drag a handle | audition |
| Lengthen | — | Grows an open end along its tangent or curvature | Drag an end anchor | audition |
| Corner shape | — | Rounds, chamfers, or scoops a corner anchor | Drag a corner widget | audition |

## Click on a path

| Operation | Action id | What the click does | Default binding | Status |
|---|---|---|---|---|
| Select anchor | `selectAnchor` | Selects an anchor | Click | main |
| Insert anchor | `insertPathAnchor` | Adds an anchor on the segment | Alt+click | main |
| Cut path at anchor | `cutPathAtAnchor` | Opens the path there | Alt+Shift+click | main |
| Trim segment | `trimPath` | Removes the piece between the nearest crossings | Click with the Trim tool (Y) | main |
| Extend to next path | `extendToMeet` | Carries an open end to the next stroke | Click with the Extend tool (U) | main |
| Slice | `slice` | Cuts shapes along a drawn line | Slice tool (K) | main |

## Brush strokes over a path

| Operation | Action id | What the brush does | Default binding | Status |
|---|---|---|---|---|
| Simplify brush | `simplifyBrush` | Removes anchors it passes over, refitting the curve | Drag with the brush | main |
| Smudge brush | `smudgeBrush` | Pushes the outline along with the pointer | Drag with the Smudge tool (S) | main |
| Puppet warp | `puppet.drag`, `puppet.addPin`, `puppet.removePin` | Pins the path and bends it when a pin is dragged | Puppet warp tool (B): click pins, Alt+click a pin takes it out, drag a pin bends | landing |

## Handles on the box around a selection

| Operation | Action id | What the handles do | Default binding | Status |
|---|---|---|---|---|
| Perspective and free distort | `distort.drag` | Corner pins warp the selected paths | Drag a corner with the Distort tool (F) | landing |
| Envelope mesh (to be renamed Cloth warp) | `envelope.drag` | A grid of control points warps the selection | Drag a mesh point with the Envelope tool (M) | landing |

## Commands on the selection

| Operation | Action id | What it does | Default binding | Status |
|---|---|---|---|---|
| Join | `joinPaths` | Joins two open ends with a straight segment | Mod+J | main |
| Join anchors | `joinAnchors` | The same, from two selected end anchors | Mod+J in path edit | main |
| Bridge | `bridgePaths` | Joins two open ends with a curve along each end's heading | Mod+Shift+J | main |
| Bridge anchors | `bridgeAnchors` | The same, from two selected end anchors | Mod+Shift+J in path edit | main |
| Average anchors | `averageAnchors` | Moves selected anchors to their mean, or lines them up on one axis | Mod+Alt+J | main |
| Cut at crossings | `snipAtCrossings` | Splits paths where they cross | — | main |
| Simplify | `simplifyPath` | Removes anchors the curve does not need | — | main |
| Offset path | `offsetPath` | Grows or shrinks the outline by a distance | — | main |
| Retract handles | `retractHandles` | Collapses selected anchors' handles | — | main |
| Make handles symmetric | `makeHandlesSymmetric` | Equal length, opposite direction | — | main |
| Delete anchors | `deleteAnchors` | Removes selected anchors | Delete | main |
| Harmonize curvature | `harmonizeAnchors` | Rescales a smooth anchor's handles so curvature is continuous | H in its lab only | main |
| Blend | `blend` | Live steps between two shapes | — | main |
| Bend along a path | `bendAlong` | Lays a shape along a spine | — | main |
| Repeat along a path | `repeatAlong` | Live copies placed along a path | — | main |
| Expand warp | `expandWarp` | Drops a held distort, envelope, or puppet warp, keeping its geometry | — | landing |
| Warp settings | `configureWarp` | Remakes a held warp with new settings | — | landing |
| Resample | — | Spreads anchors evenly by arc length | — | audition |
| Add extremes | — | Adds anchors at each curve's leftmost, rightmost, top, and bottom | — | audition |
| Grow, shrink, and every-Nth selection | — | Selects anchors along the path | — | audition |
| Segment type | — | Turns selected segments straight or curved | — | audition |
| Path start and direction | — | Sets where a subpath starts and which way it runs | — | audition |

## Gestures shared today

Places where one gesture already reaches several operations, which a variant set would make
explicit:

- **A drag on an anchor or handle** runs `editAnchors`, with handle locks, constraints, and (in
  audition) soft selection and handle snap all shaping the same drag.
- **A click on a stroke** trims or extends depending on the tool held; Insert and Cut add a
  modifier to the same click.
- **A brush drag** simplifies or smudges depending on the tool.
- **Mod+J** joins, Mod+Shift+J bridges, and Mod+Alt+J averages, in both the path and anchor
  forms.
