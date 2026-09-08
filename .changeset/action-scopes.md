---
'@weasel-js/core': patch
---

A canvas opting out of an action no longer takes it away from its siblings.

`useViewportActions` answered `pinchZoom: false` with
`reg.unregister('viewport.pinchZoom')`, which drops *every* registrant of that
id — so one canvas opting out killed pinch-zoom on a sibling that asked for it,
and nothing put it back when the opting-out canvas unmounted.
`actions={{ id: null }}` went through the same door. Registration has been
per-registrant since the registrant stack landed; suppression was not, and a
shared registry had nowhere to hang "not for me".

`ActionsScope` is that place. It is a view of the registry in scope with its own
mute set: `register`, `unregister` and the dispatcher / dep-registry slots pass
straight through to the shared store, so cross-canvas sharing is untouched,
while `list`, `trigger` and `begin` skip what this scope muted. Scopes nest.
`<ActionsProvider>` is itself a scope, so a lone canvas needs no wrapper, and a
`<SceneCanvas>` deferring to a host provider now mounts one.

`ActionsRegistry.mute(id)` returns a release; a scope drops everything it muted
when it unmounts. `unregister` keeps its old meaning — "this action should not
exist" — and is unchanged.

Breaking for anyone implementing `ActionsRegistry` themselves: `mute` is a new
required method.
