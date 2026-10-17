---
'@weasel-js/core': patch
'@weasel-js/labkit': patch
---

`contextMenuAction` (`menu.context`) and `openContextMenu` are public from `@weasel-js/core`. They
need only `menuHost`, `view` and `worldToClient` to open a menu at a right-click or, from Shift+F10
and the ContextMenu key, at the middle of the view; a scene's selection and hit testing refine the
hit where they are supplied. labkit's trial cameras now register this action instead of their own
copy.
