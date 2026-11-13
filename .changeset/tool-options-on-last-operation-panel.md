---
'@weasel-js/routing': minor
'@weasel-js/core': minor
---

A tool's options show on the last-operation panel after it runs: a rectangle's fill, stroke and stroke width, a placed sticky note's paper and ink.

Changing one there redraws the shape and keeps the value as the tool's option, shared or its own as the tool declares it. Every tool with `ToolDef.options` gets this, in every package. The mechanism is a new `ActionTuning.form`: the params a tuning supplies, as a form the panel draws beside the action's own `params`. An action with no `params` of its own that a tuning gives a form is kept as the last operation too.

```ts
registry.tune('widen', { params: () => ({ tint }), form: TINT_FORM, keep: (p) => saveTint(p.tint) });
```

<!-- entry: rank=10 new api -->
