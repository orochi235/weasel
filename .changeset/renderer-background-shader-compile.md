---
'@weasel-js/renderer': minor
---

A new canvas's first frame waits less on shader compiles, which run in the background where the browser offers `KHR_parallel_shader_compile`.

A new renderer starts the batch program and the build its text draws with at once, and returns without waiting for either; the first frame that draws with a program waits only for what is still compiling. `renderer.programsReady()` says, without waiting, whether everything started has finished, so a host can hold its first frame until then rather than block the main thread.

For a backend of your own: `GpuDevice` gains `compilesInBackground`, `GpuProgram` gains `ready()` and `settle()`, and `GpuProgramOptions.attributes` names the attribute locations the source declares, answered before the link.

<!-- entry: rank=5 perf api -->
