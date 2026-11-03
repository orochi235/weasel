---
'@weasel-js/labkit': patch
---

Requires `windease` 2.3.0 or later, which lays out only the panes it shows. `Split` with `sidebar={null}` now leaves its sidebar pane unshown, where it used to show the pane and hide it again so the strip would not keep the pane's room and draw its seam. What renders is unchanged.
