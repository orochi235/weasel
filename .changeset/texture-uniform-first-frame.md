---
'@weasel-js/core': patch
---

On the frame a `TextureHandle` uniform was first uploaded, the sampler bound before it went blank: a `kind: 'shader'` command with two texture uniforms drew its first one black, and an effect with a texture uniform read a black `u_source`. A canvas that paints on demand kept that frame. Each texture now uploads on its own unit.
