---
'@weasel-js/menu': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/hud': patch
---

Menus hang under a rect and register commands from callbacks. `placeMenuUnder` in `@weasel-js/menu` is new public API: it places a menu under a rect, flips it above, and right-aligns it at the right edge. `MenuOpenRequest.under` is an additive field, honored by the DOM and WebGL menu renderers, and `BarMenu` passes its button's rect. `BarMenu` takes an additive `defaultOpen` prop: it opens the menu once on mount, without taking focus, retrying as commands register until the menu has rows. `useCommand(id, label, run, options?)` is new public API in `@weasel-js/routing/react` and `@weasel-js/core`. The asset editor files menu roots under a "Menus" heading and previews them open.
