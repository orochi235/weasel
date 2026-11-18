---
'@weasel-js/geom': major
'@weasel-js/core': major
'@weasel-js/text': major
---

Point-containment tests are named `xContainsPoint`, as `pathContainsPoint` is.

geom's `pointInPolygon` is `polygonContainsPoint`, core's `pointInRotatedRect` is `rotatedRectContainsPoint`, and text's `pointInTextPose` is `textPoseContainsPoint`. Arguments are unchanged.

```ts
// before
if (pointInPolygon(coords, x, y)) …
// after
if (polygonContainsPoint(coords, x, y)) …
```

<!-- entry: breaking api -->
