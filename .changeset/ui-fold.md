---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`useCollapse` now also answers `body` (the contents' id and hidden state) and `control` (the props a toggle button takes), and `Subpanel`, `PropertyGroup`, and `PropertyPanel` draw their twisty from it.

`SidebarPanel` gains `trailing` (controls for the panel itself, such as undock, drawn after `actions`), `fill` (take the height the container leaves and hand it to the body), `headerRef`, `headerClassName`, `titleClassName`, `bodyClassName`, and the appearance props (`stance`, `grade`, `emphasis`, `tint`). Its collapse button now names its body with `aria-controls`. Its own styles sit in `:where()`, so a consumer's class on any part outranks them.

labkit's sidebar sections, docked and undocked, are now drawn by `SidebarPanel`, so their headers carry the fold mark.
