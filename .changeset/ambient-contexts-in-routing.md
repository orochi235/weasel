---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

routing: the pointer store and the selection context live in `@weasel-js/routing/react` now. That is `PointerContextProvider`, `createPointerStore`, `usePointerContext`, `usePointerPosition`, `SelectionContextProvider`, `SelectionContextProviderIfRoot`, `useSelectionContext`, and `usePublishSelection`, with the `PointerContextValue`, `PointerWorldPos`, and `SelectionContextValue` types. `@weasel-js/core` still exports every one of them.
