---
'@weasel-js/ui': patch
---

An `action` leaf naming a parametric action by its bare id — `align` rather than `align:left` — draws one button per variant in a bar and one row per variant in a panel, as a menu already did, in place of a dead button whose tooltip said there was no such action. The schema editor no longer marks such a leaf "no action" either. `actionLeafVariants(leaf, actions)` is the expansion both surfaces use.
