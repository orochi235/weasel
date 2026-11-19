---
'@weasel-js/clock': patch
---

`holdAt`'s `pending()` reads null once the clock stands where the hold put it, for every origin and shown time.

<!-- entry: fix -->
