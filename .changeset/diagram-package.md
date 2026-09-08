---
'@weasel-js/diagram': patch
'@weasel-js/core': patch
---

New package `@weasel-js/diagram` — the skeleton of weasel's node-link
diagramming: flowcharts, pipelines, code-flow diagrams, simple visual
programming. Arc 3 of the diagram design; edges, routing, the connect gesture
and layout are still to come.

**`DiagramNode` is a trait on an existing scene node, not a node type the
package mints.** A text block, an image, a path, a group or a plain rect all
become participants by carrying it, and nothing has to be authored through this
package to take part. Two ways to attach it, both answered by the default
reader: on the node's own `data.diagram`, or by kind — `createDiagramNodes`
takes predicates over `data` the way `createNodeRouting` does, so a class of
node takes part without being stamped one at a time.

**Ports default to the perimeter, so a node needs to say nothing to be
connectable.** `portsOf(node, pose)` resolves every port to a world point and
an outward normal, reading bounds through the pose descriptor and carrying the
node's rotation. Anchors are normalized against the bounds — `{ u, v }` from
the top-left — so a port stays where it was put when the node is resized.

**The body builder is optional**, for nodes that should look like a flowchart
box: `rect`, `diamond`, `stadium` and `parallelogram` outlines plus a `Row[]`
body of labels, fields, port rows and slots. Rows measure a floor, and the
authored pose is maxed against it rather than set to it — adding a row can grow
a node, nothing shrinks one back — which is what keeps resize, align,
distribute, guides, snapping and undo free of a special case. Text measurement
is a seam rather than an import; `canvasMeasure` adapts a 2D context.

Rows lay out in the shape's **content box**, not its bounding box.
`contentBox` reports the largest axis-aligned box inside an outline — a
diamond's inscribed rect, a parallelogram minus its lean, the flat span between
a stadium's ends — and `boxForContent` inverts it so the floor grows to suit.
Without it a diamond's label is placed against the bounding box, lands outside
the diamond, and the silhouette clip removes it: the label simply vanishes.

`registerDiagramShape` paints a node whose trait names an outline, and reports
the outline as its silhouette so picking and clipping follow the diamond rather
than its box. Rows are not painted there — a built body's rows are ordinary
scene nodes, so the kit's own text painter draws them and text editing,
selection and styling work on them unchanged.

Core exports `AUTO_POSE_DESCRIPTOR` and `isPathLike`, which were already
general-purpose but reachable only from inside the package. A peer package
computing a node's bounds needs the kit's own default descriptor rather than a
second copy of it.
