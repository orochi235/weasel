---
'@weasel-js/ui': patch
---

A toast's `ttlMs` of NaN, 0 or a negative number throws a `RangeError`.

Calls that used to pass silently now throw; pass `null` or `Infinity` for a toast that stays.

A `toast.ttlMs` kit setting that is not above 0 warns in development and times toasts by 8000 ms.

<!-- entry: fix -->
