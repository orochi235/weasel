---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

`<SceneCanvas tune>` changes a built-in action on one canvas without restating it. Keyed by action id, an entry sets `params` every invocation starts from (a thunk is read on each call, so a value changed mid-drag reaches an ongoing action) and adds `bindings` beside the action's own. A binding's or a `trigger` call's own params are laid over the tuned ones. The tuning applies to whichever descriptor holds the id, from a preset or a tool, so setting a param no longer means copying the gesture that reaches the action. Additive: `ActionsRegistry.tune(id, tuning)` underneath it, `tuneAction`, the types `ActionTuning`, `ActionTunings`, `ActionParams` and `TunedBinding`, and `ActionParamSchema`, which types params by action id for the kit's parametric actions and takes an app's own entries by declaration merging, as `DepSchema` does. `BoundGesture` is no longer marked experimental.

`SceneCanvasViewport` names the type of `<SceneCanvas viewport>`.
