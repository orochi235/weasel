---
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Constraint links follow whole-node drags live, and broken ones are drawn.

- core: move, resize and rotate preview the nodes a constraint link ties as they will commit, every frame, through the same finishing the commit runs, and `transformPreviewFields` gives a drag its preview fields with them added.
- path-tools: `createConstraintLinkMarks(style)` is a screen-space layer, carried by `constraintsPreset`, that draws every broken link: its constraint's mark by the anchor it holds and a dashed line to where it wants that anchor, in the conflict color. `brokenConstraintLink(scene, id)` and `brokenConstraintLinks(scene)` read the links that do not hold, `constraintLinkMarks` draws a list of them, and `DEFAULT_CONSTRAINT_STYLE` is exported.
