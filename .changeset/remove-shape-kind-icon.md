---
'@weasel-js/ui': patch
---

`ShapeKindIcon` is removed from `@weasel-js/ui`'s exports, along with its `ShapeKindIconProps` type. This is a breaking change for anything importing it. The glyphs it chose between are still exported individually (`RectIcon`, `EllipseIcon` and the rest).
