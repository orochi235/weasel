---
'@weasel-js/forge': patch
---

The sidebar's Components view nests a component whose title extends another's in the same library inside that
component, ahead of its stories, as the Tree view does: `Primitives/Prefs/Split values` sits under `Prefs` rather
than as a top-level `Split values`. A filter that drops the parent leaves the child on its own row.
