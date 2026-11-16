---
'@weasel-js/routing': minor
---

The actions registry and the dep registry each hand out a `reflection` of what is registered at their own scope.

`useActionsRegistry()?.reflection` and `useDepRegistry().reflection` are `@weasel-js/registry` reflections: each id or dep name with its live registrant and the ones it displaced, for a debug overlay or a conflict check. They cover the scope itself, not the ones above or below it. Both members are optional on the interfaces, so a hand-built registry may leave them out.

<!-- entry: api -->
