---
"@weasel-js/core": patch
"@weasel-js/routing": patch
"@weasel-js/cursor": patch
---

Extract binding-to-action routing into `@weasel-js/routing`.

The gesture dispatcher, the action registry and invoker, tool and contribution
declaration, the route grammar's reflection surface, and the eligibility rule
algebra now live in their own package beside `@weasel-js/gestures` and
`@weasel-js/history`. It ships two entry points: the pure dispatcher on the main
entry — no React, no DOM — and the React seam that pumps browser events into it
behind `@weasel-js/routing/react`, with React an optional peer. A kernel that
drives routing itself can take the first without the second.

`@weasel-js/core` depends on the new package and re-exports every symbol that
moved, so **no existing import changes**, including `@weasel-js/core/routing`.
A consumer that adds its own dependency still writes
`declare module '@weasel-js/core'`; the merge carries through core's re-export.

`createPaintedCursorState` and its types move to `@weasel-js/cursor`, where the
cursor they hold is declared. `@weasel-js/core` re-exports them unchanged.
