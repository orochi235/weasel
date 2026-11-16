---
'@weasel-js/core': major
'@weasel-js/routing': minor
---

`useHandleDrag` and its types move from `@weasel-js/core` to `@weasel-js/routing/react`.

This is breaking: import `useHandleDrag`, `HandleDragPoint`, `HandleDragEnd`, `UseHandleDragOptions` and `UseHandleDragReturn` from `@weasel-js/routing/react`. The hook is unchanged.

<!-- entry: breaking api -->
