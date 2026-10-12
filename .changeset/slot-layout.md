---
'@weasel-js/guides': patch
---

Adds API: `slots({ arrangement })`, a layout strategy that keeps a container's children in a sequence of slots whose positions depend on how many children there are, so the arrangement re-spaces itself as children come and go. `rowSlots`, `gridSlots`, and `ringSlots` are the arrangements it ships with, and an `Arrangement` is any `(bounds, count) => Slot[]`; one that returns fewer slots than it was asked for caps the container.

Decided on an agent's judgment: a child's place in the sequence is the slot it sits nearest, not its index among the container's children, so reordering is a pose change and z-order is left alone. Dropping on a slot inserts there and shifts the children between, where `tileGrid` swaps. A slot is a center point; the default `slotToPose` centers the child's own size on it, and a ring slot's outward `angle` is passed through for a `slotToPose` that wants to turn the child.
