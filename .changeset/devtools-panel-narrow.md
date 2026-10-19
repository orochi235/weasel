---
"@weasel-js/devtools": patch
"@weasel-js/core": patch
"@weasel-js/labkit": patch
"@weasel-js/ui": patch
"@weasel-js/theme": patch
---

The devtools panel fits a narrow container: below 480 px wide its tabs wrap and the Scene and
Registry tabs stack their list above the detail. Its header keeps the canvas picker at the left and
the version at the right, a selected tree row is marked in the accent color, and the node detail's
values line up.

A `<SceneCanvas>` with no `aria-label` or id of its own is listed in devtools by the `aria-label` of
its nearest labeled ancestor. labkit's `TrialSceneCanvas` labels its canvas with the trial's title.
`Tree` reads the new `--wzl-tree-selected` hook for a selected row's background.
