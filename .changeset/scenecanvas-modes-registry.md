---
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/modes': patch
---

`<SceneCanvas>` takes the app's mode registry as `modes` in place of `getActiveMode`. This is a breaking change: replace `getActiveMode={getActiveModeFor(registry)}` with `modes={registry}`. The canvas now repaints when the mode switches, and the dev-time route-conflict check reads the app's own modes instead of the kit's `DEFAULT_MODES`, so a clash that only an app-defined mode allows is reported. `useTools` and `useContributions` take the same `modes` option for a consumer assembling its own tools.
