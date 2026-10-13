---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

`ShaderDrawCommand`, the module-level `registerProgram`, and `WeaselRenderer.registerProgram` are no longer marked `@experimental`, and a shader command's program compiles on the first frame that draws it. Before, a renderer drew a shader command only if the program had been compiled on it first, through `<Canvas shaders>` or `renderer.registerProgram(handle)`, so a custom `RenderLayer` had no way to draw one without reaching the renderer. Now a layer emits the command with the handle `registerProgram()` returned and nothing else: the renderer compiles it through the path effects and paint kinds already use. `shaders` and `renderer.registerProgram` remain, for compiling ahead of the first frame and for catching `ShaderCompileError`. A command whose id was never registered, or whose source does not compile, draws nothing and warns once, where it warned on every frame. Dropping the tag was done on an agent's judgment; `registerEffect` keeps its own.
