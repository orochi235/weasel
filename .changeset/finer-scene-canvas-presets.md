---
'@weasel-js/core': patch
---

`<SceneCanvas features>` takes four finer presets. `select` mounts the select tool and `outline` draws the selection outline, so a canvas supplying its own select tool can name `outline` without the built-in one mounting beside it. `resize` and `rotate` each draw and bind one kind of handle, so a resize-only canvas no longer hides the rotation handle by hand. The existing presets keep their meaning as abbreviations: `pick` is `select` + `outline`, `transform` is `resize` + `rotate`, and `draw` is every base preset. `COMPOSITE_FEATURES` lists what each abbreviates, and the new `selectionResizeContribution` / `selectionRotateContribution` (with their `…Bindings` and ids) are the ambient entries the two handle presets install; `selectionTransformContribution` still carries both.

Additive for any canvas that names presets, but `FEATURE_ACTION_IDS` and the `BaseFeature` type are now keyed by the base presets — `select`, `outline`, `resize`, `rotate` in place of `pick` and `transform` — so code indexing that table by `pick` or `transform` has to expand through `COMPOSITE_FEATURES` first.
