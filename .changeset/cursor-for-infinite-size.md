---
"@weasel-js/cursor": patch
---

`cursorFor` throws a `RangeError` for a size of `Infinity`, as `bakeCursor` does for any size past the 128 px cap, where it baked the cursor at the default 24.
