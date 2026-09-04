---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Re-export the icon set through `@weasel-js/labkit/weasel-ui`, and give the
three workspace-layout glyphs named components.

A lab that depends only on `@weasel-js/labkit` could not draw a kit icon at
all: the passthrough carried every other primitive but not `Icon`,
`ICON_PATHS` or their types, so the only way in was a direct `@weasel-js/ui`
dependency — the thing the passthrough exists to avoid.

`LayoutRowsIcon`, `LayoutColumnsIcon` and `LayoutGridIcon` join the named
glyph components in `@weasel-js/ui`.
