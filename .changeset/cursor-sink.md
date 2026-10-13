---
'@weasel-js/cursor': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

Fixes a tool's cursor disappearing after a hover cursor: with a tool that declares a `cursor`, moving over something that shows a cursor of its own and off again left the canvas with no cursor until the tool changed. `SceneCanvas.toolCursor.test.tsx` shows it with a registered layer's hit claim. The tool's cursor and the hover cursor were written to the same inline `cursor` style by two writers, and clearing the second removed the first.

Adds API: `createCursorSink({ element, painted })` in `@weasel-js/cursor`, also exported from `@weasel-js/core`, is one writer for both. It holds a base cursor and an override, writes the element's `cursor` style and the painted-cursor state, and puts the base back when the override clears. A canvas makes one and exposes it as `CanvasExtensionApi.cursorSink`; `useGestureDispatcher` takes it as the `cursorSink` option, and without one behaves as before. A hand-built `CanvasExtensionApi` now needs the `cursorSink` field.
