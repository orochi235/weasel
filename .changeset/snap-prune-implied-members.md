---
'@weasel-js/geom': patch
---

`resolveSnap` no longer lists a candidate in `members` when the other members already pin the same move — a line taken before a point on it now reports only the point. Such a candidate still appears in `satisfied`, and it no longer breaks a tie between two equally near combinations on its order.
