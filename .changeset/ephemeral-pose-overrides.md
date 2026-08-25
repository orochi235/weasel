---
'@weasel-js/core': patch
---

Add ephemeral pose overrides to the scene

`scene.overrides` holds a per-node `{ pose?, alpha? }` that the render and
hit-test paths read through and that history, `toJSON()` and `getVersion()`
never see. It is additive: a scene with no overrides behaves exactly as before.

This is where per-frame motion belongs. A 60 Hz loop previously had to write
through `setPose`, which records an undo entry (one per frame at best, batched)
and bumps the scene version, re-rendering every `useSyncExternalStore`
subscriber. It also had to allocate a fresh pose object per moving node per
frame, because the painter memo keys on pose reference. An override entry is
hoisted once and mutated in place; `overrides.commit()` publishes the frame and
invalidates the memo for the overridden nodes only.

`commit()` is required after an in-place mutation — without it the memo serves
the previous frame's draw. Overrides are cleared when a node is removed, since
ids are reusable. To make a frame permanent, write it once through `setPose`
and clear the override; that single step is the undo entry.

`ForceGraphDemo` now settles with zero history entries and bakes the result as
one, replacing a per-tick batch of 24 `setPose` calls.
