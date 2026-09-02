---
'@weasel-js/labkit': patch
---

The Save snapshot button moves from a trial's toolbar to the end of its title
bar, beside clone and reset. The three are one group of trial-level actions and
now read as one. `Mod+S` is unchanged — the handler is on the trial element, not
the region. The Load snapshot picker stays in the toolbar; it is a select, not
an icon button.
