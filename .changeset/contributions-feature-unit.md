---
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/hud': patch
---

A feature installs from one entry. `SurfaceContribution` extends `Contribution` with `views` and `attach(api, deps)`, and `Contribution` gains `deps`; `<SceneCanvas ambient>` installs every role an entry declares and removes them with it. `mergeContributions` throws on a duplicate dep name or view id as well as a duplicate entry id.

Bindings can be scoped to views with `opts.views`; a binding that names the view an input landed in outranks bindings that do not. `InvocationCtx.viewId` and `RuleCtx.viewId` carry that view, layer `data.viewId` names the view a draw is for, and the `rootView` dep answers the surface camera from inside a view.

`createMinimapContribution` puts a minimap inside a canvas, with a linked crosshair, and `createLinkedCursorContribution` draws the crosshair alone. `<MinimapCanvas>` now runs on a dispatcher, publishes its pointer, and takes an `id`.

Breaking: `PointerContextValue` is a store — `get`, `set`, `subscribe`, `getVersion` — in place of `pointerRef`, and `PointerWorldPos` carries `viewId`. `usePointerPosition()` follows it. `useHud`'s ref is optional; `useHudContribution(hud, options)` attaches the HUD as well as routing its input.
