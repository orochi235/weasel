---
'@weasel-js/core': patch
---

Content far from the origin no longer pans in whole-pixel steps at high zoom. The renderer's matrices are in doubles: `GlMat3` is now `Float32Array | Float64Array`, and `viewToMat3`, every `mat3` function, and `rotateAroundAABBCenter` return a `Float64Array`. A `Float32Array` transform is still accepted everywhere. This is a type change for code that passes a kit matrix to `gl.uniformMatrix3fv` or annotates one as `Float32Array`: `mat3.toUniform(m)` is the float32 copy, and a shader command's uniform value may be a `Float64Array`. The built-in path, gradient, and pattern vertex shaders gained a `u_origin` uniform, which the renderer uses to keep a large translation out of the float32 `u_model`.
