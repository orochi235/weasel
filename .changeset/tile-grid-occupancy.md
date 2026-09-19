---
'@weasel-js/core': patch
---

`tileGrid` no longer lets two children land in one cell. A drop from outside the container is offered only the free cells, so it lands in the nearest free one, a multi-select drop fills distinct cells, and a full grid rejects the drop. A drag within the container still swaps with the child in the cell it lands on, and the swap now finds that child by where it sits rather than by id order, so it keeps working after an earlier swap. The new optional `centerOf` option says which point of a pose decides its cell; the default suits rect and point poses. Behavior change, additive API.
