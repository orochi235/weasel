---
'@weasel-js/ui': patch
---

`CodeBlock` is now a memoized component, so a parent re-rendering with the same props no longer rebuilds its token spans. The schema editor's export literal, several thousand spans for a node's schema, was rebuilt on every selection in the editor.
