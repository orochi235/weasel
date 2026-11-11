---
"@weasel-js/registry": patch
---

`freshId` no longer hangs when `from` is past 2^53 and its first id is taken. Counting past the largest number throws a `RangeError`.

<!-- entry: rank=-5 fix -->
