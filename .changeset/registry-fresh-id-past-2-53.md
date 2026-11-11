---
"@weasel-js/registry": patch
---

`freshId` no longer hangs when `from` is past 2^53 and its first id is taken: it steps to the next number up, where adding one rounds back. Counting past the largest number throws a `RangeError`.
