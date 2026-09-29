---
"@weasel-js/core": patch
---

A drag under a `reflowTransition` now lands the dragged node the way its siblings move: on release it glides from where it was let go onto its committed slot (or back home on a cancel) instead of jumping there. A node grabbed while still gliding is held where it is shown, and the drag starts from there rather than from its document pose; a free drop of it commits where it was shown under the pointer. The drop is still one undo step. To support this, `ReflowTransition.glide` and `settle` take an optional `{ from }` (`ReflowGlideOptions`): `glide` restarts from that pose, and `settle` with `from` takes over a node the transition was not moving. Additive; a custom `ReflowTransition` that ignores the new argument still type-checks, and its dragged nodes snap as before.
