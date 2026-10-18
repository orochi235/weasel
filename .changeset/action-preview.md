---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

An action can say what it would do before it runs. `Action.preview(deps, params)` shows it and returns what takes it down; `ActionsRegistry.preview(id, params)` asks for it under the same `enabled` check and tuned params `trigger` uses, and returns that function. A bar's action button shows its action's preview while it is hovered or focused, and takes it down on leaving or pressing. `<SceneCanvas>` sources a `previewPaths` dep, `show(paths)` over the canvas (`createPreviewPaths`, `usePreviewPathsDepSource`), and every Pathfinder action previews the outlines of the pieces it would make on it. Additive, except for anything implementing `ActionsRegistry` by hand, which now needs `preview`.
