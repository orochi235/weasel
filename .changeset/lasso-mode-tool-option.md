---
'@weasel-js/core': minor
---

The lasso's hit mode is a tool option, so its options row offers Touched, Enclosed and Centers.

`LASSO_TOOL_OPTIONS` declares it, kept per tool. `useLassoTool({ mode })` and `<SceneCanvas toolOptions={{ lasso: { mode } }}>` now set the option's default, and the binding's params carry only `minVertexSpacing`.

<!-- entry: new api -->
