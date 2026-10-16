---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Lengthen: in path edit, turn on the Lengthen path-edit tool and drag an open path's end anchor outward to grow the path from that end, or inward to shorten it along itself. It grows straight along the end tangent, or along a circular arc with the curvature the end has, meeting the path smoothly. The `lengthenPath` action's `mode` param (`'tangent'` or `'curvature'`, typed for `<SceneCanvas tune>`) sets which a plain drag does, and Shift, read on every move, picks the other. A straight end segment grows in place; a curved one is continued with a new segment, one per quarter turn of arc. Each drag is one undo step, "Lengthen path" or "Shorten path". `lengthenPreset` in `@weasel-js/path-tools` registers the action and its toggle, `pathEditTool.lengthen` (`lengthenToolAction`, drawn with `LengthenIcon`); `pathTools` includes it.

`lengthenPathEnd(set, end, distance, mode)` (`@weasel-js/geom`) is the edit underneath, with a negative `distance` shortening. `openEndAt` names the open end an anchor is, `pathEndFrame` gives an end's point, outward tangent, and signed curvature, `lengthToward` turns a pointer position into a distance, and `pathEndAnchorIndex` finds the end anchor again after an edit. `lengthenOpenEnd`, which Extend to next path uses, is now `lengthenPathEnd` in tangent mode, so both tools grow a curved end by the same rule.

While a path-edit tool is on, path edit's anchors and handles no longer show their own hover cursor, so the tool's action shows its own.
