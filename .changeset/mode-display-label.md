---
'@weasel-js/modes': patch
---

`ModeDefinition` takes an optional display `label` and a one-sentence `description`, so chrome that names the active mode — a breadcrumb, a status bar, a tooltip — reads it off the definition instead of keeping its own id-to-name table. `modeLabel(mode)` returns the label, or the id when there is none. The six stock modes in `DEFAULT_MODES` carry both.
