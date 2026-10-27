---
'@weasel-js/routing': patch
---

`holdPreview` runs its action with the deps it had when the key went down. It used to run it with the release's, which a gesture's end never carries, so an action reading any dep (every Pathfinder operation reads `booleansAdapter`) did nothing on release.
