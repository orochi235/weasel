---
'@weasel-js/core': patch
---

`derivePose` now notices a dependency that moved with nothing pushed behind it.
The memo is keyed on the deriving node's own authored pose, which only changes
when someone pushes an invalidation — so an ancestor's frame moving, a removal,
a dependency appearing, or a lookup answering poses of its own all left the
derived pose stale. It now records what it derived from and re-checks it by
value on a memo hit, the way `resolveDerivedPath` already did. The compare both
paths use is shared in `depMemo.ts`.
