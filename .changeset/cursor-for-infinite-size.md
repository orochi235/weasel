---
"@weasel-js/cursor": patch
---

`cursorFor` throws a `RangeError` for a size of `Infinity`, as `bakeCursor` does for any size past the 128 px cap.

<!-- entry: rank=-5 fix -->
