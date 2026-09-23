---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

The theme gains a transparency checker and a workspace pair. `--wzl-checker-a` and `--wzl-checker-b` are the checker's two squares (`border` and `surface`) and `--wzl-checker-size` is one repeat of it (8px); `PaintField` and `ColorField` now paint their empty and mixed chips from them instead of each restating the gradient's colors and size, so a theme can restyle every checker at once. `--wzl-workspace-surface` (`surface-sunken`) and `--wzl-workspace-line` (`line-subtle`) are the ground of a canvas app's workspace — the area around the document page — and the marks drawn over it. All five follow the color mode.
