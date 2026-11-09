---
"@weasel-js/text-dom": patch
---

A run's `fontScale` goes through the edit overlay unchanged: `0.07` is written as `7%` and read back as `0.07`, where it was written as `7.000000000000001%` and came back as `0.07000000000000001`.
