---
"@weasel-js/core": patch
---

Give a canvas its own provider scope with `<WeaselProvider isolate>`

An actions registry holds exactly one dispatcher, so a second `<SceneCanvas>`
joining a scope displaced the first and took its input away. Worse, the
detach was unconditional: whichever canvas unmounted — or merely re-rendered
with a new dispatcher identity — cleared the slot for the one still on screen.
The symptom was a canvas that stopped responding, naming neither canvas nor the
registry they shared.

`isolate` mounts every provider unconditionally instead of deferring to one
already in scope, so canvases that merely coexist get a scope each. This is the
shape consumers had already reached for by hand: `AnimationDemo` and
`BooleanOpsDemo` both mounted raw `ActionsProvider` / `SelectionContextProvider`
/ `DepRegistryProvider` to shadow the ambient scope, and both now say `isolate`
instead.

`setDispatcher` and `setDepRegistry` return a release that clears the slot only
while the caller still holds it, so a departing canvas can no longer disable a
surviving one. A second dispatcher claiming an occupied registry warns once,
naming `isolate` as the fix.

Two canvases still cannot *share* one registry: a toolbar outside both has
nothing to say which one it drives. That needs a focused-canvas concept and is
not in this change.
