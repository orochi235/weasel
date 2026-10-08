---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

New `--wzl-surface-popover` token: the background of dropdowns, menus and other popover lists (`Select`, `MenuButton`, `ComboBox`, `PaintField`'s popover). It follows `surface-raised` by default. The interstellar theme pins it at 92% opacity instead of its panels' 55%, so a list over busy content stays readable.
