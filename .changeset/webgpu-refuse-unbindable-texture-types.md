---
'@weasel-js/renderer': patch
---

On WebGPU, a custom shader declaring a texture other than `texture_2d<f32>` or a sampler other than `sampler` throws, naming the binding.

<!-- entry: fix -->
