---
'@weasel-js/renderer': patch
---

A retained group holding a custom shader drawn through the kit's vertex shader now keeps a surface covering only the shader's `bounds`, not the whole drawing buffer. Adds a kit uniform: a fragment shader that declares `uniform vec2 u_fragOrigin;` is given the offset to subtract from `gl_FragCoord.xy` to get its device pixel in the renderer's own drawing buffer, which a tile of a shared canvas, a group's effects and a retained surface each move. A program reading `gl_FragCoord` without declaring it, or supplying its own vertex shader, still makes its retained layer keep a whole-buffer surface.
