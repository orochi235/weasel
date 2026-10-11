---
'@weasel-js/core': patch
---

The pen tool commits through the `insert` dep, as every other shape tool does. A finished path is inserted as kind `'path'` (`{ kind: 'path', path, closed }`), so a consumer who overrides `insert` or passes `insertNodeFactories.path` now shapes pen paths too, and the new path is selected through the `selection` dep. Joining a new path onto another path's endpoint uses the new optional `InsertDep.build`, which returns the insert ops unapplied so they share one undo step with the delete. This is a breaking change to `usePenTool`: `wrapPath` and `adapter` are gone from `UsePenToolOptions`, the hook is no longer generic, and its options are optional. A consumer's own `insert` dep needs a `'path'` case for the pen to insert anything, and `build` for the join.
