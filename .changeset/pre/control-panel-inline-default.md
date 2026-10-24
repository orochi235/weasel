---
"@weasel-js/labkit": patch
---

`ControlPanel` sets every row's label beside its control by default: `layout` now defaults to `'inline'`, where unset used to put most labels above their controls. Rows still pack two to a line (`pack: 'pairs'`), and the grid now drops to one column wherever the panel, or a group inside it, is too narrow for two; `--lk-control-column-min` (default `6rem`) is the narrowest a column may get before it does. Under `'pairs'`, a segmented toggle and a textarea now take the whole width, as a custom row, a bar, and a group already did.

This changes how every panel that sets neither option looks. `layout: 'block'` puts the labels back above their controls, and `pack: 'one-up'` gives each row its own line; both work panel-wide and per section.
