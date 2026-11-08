---
"@weasel-js/renderer": patch
---

Renderer fixes from an audit:

- A WebGPU renderer now compiles a WGSL program that declares a struct no uniform could hold, such as a helper struct with a `bool` member, a fragment input with `@builtin(front_facing)`, or a struct ending in a runtime-sized array. Laying the struct out used to throw, and the program drew nothing. A uniform that binds such a struct is still refused, and the error names the type.
- WGSL array sizes and `const`s written with an `i` suffix (`array<vec4f, 2i>`, `const N = 3i;`) are now read. They used to throw `unknown array size`.
- A WebGPU program now takes a write to one slot of an array uniform by its slot name (`u_ripples[2]`), as a WebGL program does. Such a write used to be dropped with a "uniform not found" warning.
