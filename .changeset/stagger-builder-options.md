---
"@weasel-js/core": patch
---

The fluent stagger form takes a `cancelKey` and a `label`, as the factory form already did. `.tween` and `.springPose` accept both in their options, and `.each` takes a `StaggerOptions` second argument. The label names the stagger's `start`, `end`, `cancel` and `interrupt` events and its `animator.live()` row; the cancel-key lets `animator.cancelKey` and `isActive` reach a fluent run, and a second run under the same key interrupts the first. Additive.
