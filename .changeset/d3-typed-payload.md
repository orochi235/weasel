---
'@weasel-js/d3': patch
---

`d3Bind` now takes its payload type from the scene: `.data(fn)` on a binding over a `Scene<{ label: string }, …>` must return `{ label: string }`, so the editor completes the fields and flags a wrong or missing one. `D3Binding` gains a third type parameter, `TPayload`, defaulting to the old `Record<string, unknown>`. A scene typed with `unknown` data accepts anything, as before.
