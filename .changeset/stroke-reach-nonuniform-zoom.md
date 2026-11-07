---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

Trim segment and Extend to next path now reach a stroke as far on screen as every other picker does under non-uniform zoom; they used to take the smaller of the two axes' world extents and could miss a stroke a few pixels from the click. geom adds `pxReach(px, scale)`, the one conversion of a screen-pixel radius to a world distance that core's anchor clicks, rig, Girth and Smudge now share.
