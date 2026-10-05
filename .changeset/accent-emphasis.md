---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Muted and subtle text on an accent fill now clears WCAG 4.5:1 in both modes. New tokens `--wzl-fg-muted-on-accent` and `--wzl-fg-subtle-on-accent` carry the higher alphas, and every weasel-ui accent fill (a primary `Button`, a selected segment or `ToggleBar` cell, an open `Prefs` rail entry, a toned `LayerList` handle) redirects `--wzl-fg-muted` and `--wzl-fg-subtle` to them. In dark mode the steps are 0.98 and 0.96, so secondary text on the accent reads nearly at full strength. A consumer drawing its own accent fill with `--wzl-fg-on-accent` text should set the same two properties on that rule.
