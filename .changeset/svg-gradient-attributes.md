---
'@weasel-js/svg': patch
---

`parseSvg` read three gradient details loosely. A percentage on a `userSpaceOnUse` gradient (`x2="100%"`, or the default when the attribute is omitted) was taken as a fraction of one user unit instead of the viewport. A stop with both a translucent `stop-color` and a `stop-opacity` kept only the opacity instead of their product. A radial gradient's `fx` / `fy` / `fr` and a `spreadMethod` of `reflect` or `repeat` were ignored silently; they are still not modeled, and now warn.
