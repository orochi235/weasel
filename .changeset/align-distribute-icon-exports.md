---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

The eight glyphs the align and distribute actions ship are now exported from `@weasel-js/core` and re-exported from `@weasel-js/ui`, beside the Pathfinder and edit-action icons: `AlignLeftIcon`, `AlignCenterXIcon`, `AlignRightIcon`, `AlignTopIcon`, `AlignCenterYIcon`, `AlignBottomIcon`, `DistributeHorizontalIcon` and `DistributeVerticalIcon`. They are the same components the actions draw, so a consumer can render one outside an `<ActionBar>` without authoring its own.
