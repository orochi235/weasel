---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
---

`<Canvas retain>` sets how a canvas retains its layers: `minCommands` is the
threshold a layer must reach, `budget` the GPU memory retained layers share,
and `false` retains no layer on the canvas. `<SceneCanvas>` passes it through.
`WeaselRenderer.setRetainBudget` changes the budget after construction. New
API; nothing existing changes.
