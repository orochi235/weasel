---
'@weasel-js/animator': patch
---

A target table can keep `shown` as a `Float32Array`. `createTargetTable({ axes, shown: Float32Array })` has the animator's pass fill 32-bit floats, so a painter uploads `table.shown` as it stands and makes no copy a frame; `table.committed` stays a `Float64Array`, and the default for `shown` is unchanged. This adds API: the `shown` option, a type parameter on `TargetTable` and `TargetTableOptions` naming the array (default `Float64Array`, so existing uses read as before), and the exported `ShownArray` type. The option's name and shape were chosen on an agent's judgment.
