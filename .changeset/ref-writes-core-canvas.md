---
"@weasel-js/core": patch
---

`<SceneCanvas>`, `<Canvas>`, `<MinimapCanvas>`, `useHostAnchor` and the
canvas's dep sources (`areaSelect`, `editAnchors`, `insert`, `view` and the
rest) no longer act on a render React abandoned. A `startTransition` that
suspends used to leave its props behind for the next event, dep read or frame:
a double click could reach the abandoned `onDoubleClick`, chrome could resolve
against the abandoned `chromeVisibility`, `selection`, `getFocused` or
`selectTool.resize.resizable`, and a dep could hand an action the abandoned
scene, adapter or selection. They now see the last committed render's values.

A function-form tool cursor's `ToolCtx` carries the selection, adapter,
`setView` and debug sink of the render resolving it; its `applyOps` writes
through the committed adapter.
