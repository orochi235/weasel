---
'@weasel-js/routing': patch
---

A tool redefined under an id that is already registered now replaces the old definition. `useTools` used to rebuild its `ToolsApi` only when the set of tool ids changed, so a new tool object under the same id — a `cursor` whose size changed, say, passed to `<SceneCanvas tools>` — kept the first definition, and the canvas went on showing the old cursor. The `ToolsApi` now changes whenever any tool in `registry` or `ambient` is a different object, and stays the same while every tool is the same object, even when the record holding them is rebuilt each render.

Tools passed to `<SceneCanvas tools>` should therefore keep their identity between renders, as the kit's own tool hooks do: a tool rebuilt every render now rebuilds the `ToolsApi` every render, which loops a canvas whose `onToolsCreated` sets state.
