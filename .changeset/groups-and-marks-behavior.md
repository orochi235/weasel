---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
---

A node is a mark or a group, and the two now behave differently:

- A group never paints, whatever its data: a `shape` or `path` on a group draws nothing, and only its members draw. A mark with children paints itself and its children. A group is hit anywhere in its box, even with no member under the press or after its last member is deleted.
- Ungroup dissolves only groups; a mark with children is left whole.
- The area hit test's `includeContainers` option is now `includeGroups` (breaking for a custom `hitTestArea` dep). Marquee and lasso take a mark and its children, and a group only when asked for.
- A mark's drawn bounds include its own ink as well as its children's.
- Any node may clip, repeat (`copies`), lay out and set units for its children, and `'inherit'` fills and strokes read from any parent.
- A drop or an insert lands in a mark only when the `canDropInto` dep admits it; with no dep, a group admits and a mark does not. An insert asks `canDropInto` with an empty list, since the new node is not minted yet.
- Diagram bodies, containers, pools and lanes are marks, so they paint again and take drops through `diagramCanDropInto`. A stencil body still takes nothing, and a press inside an unfilled lane hits the lane.
- In a diagram scene, `kind === 'group'` no longer identifies a body or a region. A region is a node where `diagramContainerOf(node)` is not null. A diagram group box is one where `diagramGroupOf(node)` is not null. A body is a node where `diagramNodeOf(node)` is not null and neither of those is.
