---
'@weasel-js/renderer': patch
---

A WGSL program can bind a uniform of plain type, such as `var<uniform> tint: vec4f`, set by the variable's name.

One of a type a uniform cannot hold is refused with an error naming the binding.

<!-- entry: fix -->
