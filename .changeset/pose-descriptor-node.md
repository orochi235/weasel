---
'@weasel-js/core': patch
---

Let a `PoseDescriptor` see the node it is describing.

Every method on the descriptor took a pose and nothing else, so two shapes
sharing a pose type — a sphere and a box both posed by position/rotation/scale —
were indistinguishable to it. New optional `forNode(node)` returns a descriptor
specialized to one node; `poseDescriptorForNode(descriptor, node)` is the
accessor, and returns the descriptor unchanged when it declares no
specialization.

This widens API. No existing signature changed, so a descriptor that ignores the
node compiles and behaves exactly as before. The kit calls `forNode` from the
sites that already hold a node — marquee and lasso hit-testing, select-tool
picking, selection chrome bounds, the container-pose cascade, the minimap union,
`arrayAdapter`, and the move and rotate actions. Sites holding only an id keep
reading the unspecialized descriptor.
