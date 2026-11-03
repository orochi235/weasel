---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
'@weasel-js/routing': patch
---

Export, as types only, the declarations the public `.d.ts` files already named but no entry exported: core's
`GestureLifecycleOptions`, renderer's `BatchStage`, and `ScopeNode`, `DepNode`, `ToolNode` and `LastOperationKeeper`
from `@weasel-js/routing/react`. A consumer whose own declaration emit has to name one of them no longer gets TS2742.
