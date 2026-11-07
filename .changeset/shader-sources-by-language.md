---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/dither': patch
---

`registerProgram` and `registerEffect` take a program's source by shading language, so a program can carry WGSL for the coming WebGPU backend beside its GLSL. This breaks every caller: `registerProgram(id, '', frag)` is now `registerProgram(id, { glsl: { frag } })`, `registerProgram(id, vert, frag)` is `registerProgram(id, { glsl: { vert, frag } })`, and `registerEffect(id, frag)` is `registerEffect(id, { glsl: frag })`. A paint kind's `programs` entries take the same shape. Leaving out `vert` selects the kit's vertex shader; an empty string no longer does. The WebGL renderer draws from `glsl` and draws nothing for a program with only `wgsl`, reporting that once. A program that fails to compile is now reported once per source, not on every frame, and is not compiled again until its source is re-registered. WGSL sources are held but not yet drawn by anything.
