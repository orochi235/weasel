---
'@weasel-js/geom': patch
---

`pathFromD` built a path from data SVG treats as in error. A `d` string with no opening moveto (`L10 10 L20 0`) became a path with no `M`, and a command with too few arguments (`L 10`, or an arc whose flag is not 0 or 1) was dropped silently while later relative commands carried on from the wrong point. Data that does not begin with a moveto now builds an empty path, a malformed command ends the path before it, and both are reported through `onWarn`.
