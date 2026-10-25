---
'@weasel-js/ui': patch
---

A Cmd-drag (Ctrl off Apple platforms) now scrolls a curved `Bar` that has no `onReorder`, and every other run row. Only a bar that reorders leaves that press to the reorder; `useRunScroll` and `useRunRow` take a new `modReorders` option for it.
