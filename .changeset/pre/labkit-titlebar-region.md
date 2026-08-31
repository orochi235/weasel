---
'@weasel-js/labkit': patch
---

Add a `titlebar` region, and move the trial's close button into it. The close
button stays a suppressible contribution rather than becoming markup baked into
the title bar, so `suppress: ['close']` still works and a consumer can put its
own control up there. `TitleBarRegion` is exported alongside the other five.

Panels no longer inset themselves. `.lk-sidebar-section__body` was insetting a
panel and then `.lk-control-panel` and `.lk-layer-list` each inset it again,
which put the first control 16px into a 161px-wide sidebar. The section body is
now the only gutter, and it is tighter.

The layer list's drag grip was inheriting the `:where(button)` element default,
so a glyph rendered in a 37×24 box with a border, an elevated fill and a
backdrop blur. It is now the glyph.

The trial title bar's bottom border moves from `--wzl-line-subtle` to
`--wzl-border`, matching the toolbar directly below it — at the subtle value it
was effectively invisible in light mode.

Save-snapshot moves from the trial group to the history group, beside undo and
redo.
