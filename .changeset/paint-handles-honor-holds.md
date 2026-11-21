---
'@weasel-js/ui': minor
---

`MeshHandles` and `GradientHandles` honor `<Disabled>` and `<ReadOnly>`, and take their own hold props.

Held, a drag or an arrow key on a handle changes nothing, and each handle says the reason. They take `disabled`, `disabledReason`, `readOnly` and `readOnlyReason`, as other controls do.

<!-- entry: fix api -->
