---
'@weasel-js/core': patch
'@weasel-js/editor': patch
---

`<EditorShell>` now gives every canvas in it default context menus: `editor.selection` on the selection (cut, copy, paste, duplicate, delete; group, ungroup; bring forward, send backward) and `editor.canvas` on empty canvas (paste, select all; undo, redo). An app adds to one by contributing a `MenuDef` with the same id on a canvas `ambient` entry, whose sections follow the editor's; `contextMenus={false}` installs none. The menus are exported as `EDITOR_CONTEXT_MENUS`, and the entry carrying them as `EDITOR_CONTEXT_MENUS_CONTRIBUTION`. This is new default behavior: an app under the shell that already defines its own selection or canvas menu now opens the editor's in its place, since the first matching menu wins, until it moves its items onto the shared ids or passes `contextMenus={false}`.

Core adds `<AmbientContributionsProvider contributions>`: every `<SceneCanvas>` below it installs those entries ahead of its own `ambient`, a canvas's `ambient` entry of the same id replacing a provided one. Nested providers accumulate, an inner entry replacing an outer one of the same id.
