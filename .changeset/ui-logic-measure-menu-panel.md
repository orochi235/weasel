---
'@weasel-js/ui-logic': minor
---

`measureMenuPanel` sizes a menu panel from theme tokens, so a DOM menu and a canvas-drawn one lay out alike.

`menuPanelMetrics(env)` reads the row height (`--wzl-control-h-sm`), padding and gaps (`--wzl-space-1`,
`--wzl-space-2`), and font (`--wzl-font-size`, `--wzl-font-ui`, `--wzl-leading-snug`). `measureMenuPanel(face,
constraints, env)` returns the panel's box and where each row's icon, label, and trailing column sit;
`menuRowSpans` and `menuRowAtY` hit-test rows. `MENU_MIN_WIDTH`, `MENU_BORDER_WIDTH`, `MENU_ICON_SIZE`, and
`MENU_CARET_SIZE` are the fixed lengths the stylesheet uses.

<!-- entry: api new -->
