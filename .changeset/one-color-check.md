---
'@weasel-js/diagram-formats': patch
---

Every graph format's reader now makes one check of each color a file names: a color paint's `parseColor` cannot read is dropped, and the reader lists it in one warning, "<format> colors a diagram cannot draw were dropped: …". The DOT, Mermaid (flowchart styles and link styles, every kind's `classDef`s and `style`s, C4 element and relationship styles, sequence boxes and rects) and draw-style XML readers used to keep such a string as the color, which nothing could draw. Effects:

- DOT X11 names CSS has no spelling for, such as `grey50`, are now dropped with that warning. No X11 table exists to map them.
- DOT `none` reads as `transparent`, as draw-style XML's does.
- The DOT warning for palette-scheme colors becomes the shared one.

The Mermaid sequence reader's own list of CSS color names is gone. It asks the same check whether a box's first word is a color.
