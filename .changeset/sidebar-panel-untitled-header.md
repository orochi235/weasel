---
'@weasel-js/ui': patch
---

A `SidebarPanel` with no `title` still draws its close button, its controls, and its fold control.

Its header shows when it folds or is given `onHide`, `actions`, `trailing`, or `headerRef`; the fold control of an untitled panel is named "Contents".

<!-- entry: fix -->
