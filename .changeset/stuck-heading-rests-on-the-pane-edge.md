---
'@weasel-js/ui': patch
---

A section heading stuck to the top of a `PrefsForm` rail pane now rests against the pane's edge. It used to sit the pane's top padding below it, leaving a strip where rows scrolling under the heading showed, and a row scrolled to under it stopped a few pixels short of the heading. The heading's line height is now `--wzl-leading`.
