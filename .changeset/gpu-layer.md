---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

The renderer draws through a backend-neutral GPU layer, with WebGL2 its only backend so far. What it paints is unchanged. Breaking for code written against the renderer's GL surface:

- A registered paint kind's `bind` no longer touches GL. It returns `{ program, uniforms }`: the id of a registered program and its uniform values by name, which the renderer binds, sending `u_proj`, `u_model` and `u_origin` itself. `PaintBindContext` loses `gl`, `program` and `setProjAndModel`; `bindRamp(stops, unit, space)` becomes `ramp(stops, space)`, returning the atlas texture and its row's `v`; and it gains `createTexture` and `deleteTexture` for a kind that bakes its own texture. `PaintProgram` is gone; `PaintBinding`, `PaintTexture` and `PaintUniform` are new.
- `ShaderProgram` is the layer's program handle. It exposes no `WebGLProgram` and no uniform locations: uniforms and textures are set by name (`set1f`, `set`, `setTexture`, …), and `has(name)` replaces `uniform(name) !== undefined`.
- `UniformArray` drops `location`.
