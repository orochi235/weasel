---
'@weasel-js/hud': patch
---

A widget can declare an `accessibleTree`: a tree of ARIA roles, states, and labels, with the node the keyboard is on marked `active`. While the widget holds focus, the hud mirrors it as visually hidden DOM beside the canvas, which owns the mirror through `aria-owns` and points at the active node through `aria-activedescendant`; a change of highlight alone moves that pointer and leaves the elements in place. The WebGL context menu declares one, so a screen reader sees its rows as `menuitem` and `menuitemcheckbox` elements with their checked and disabled states, an open submenu as a nested `menu`, and the highlighted row as it moves.
