---
'@weasel-js/core': patch
---

`<SceneCanvas>` no longer takes `selectionMode`, and `CanvasSelectionMode` is gone. Its `'multi'` only reached the selection the canvas built for itself, so a canvas handed `useSelection()` still replaced on shift-click. Click policy now has one home, the selection: `useSelection({ mode: 'multi' })`, or `selectionOptions={{ mode: 'multi' }}` for the canvas's own. `selectionMode="none"` is now `selectable={false}`, with the same meaning. Breaking: drop `selectionMode="single"`, move `"multi"` to the selection, and rename `"none"`.
