---
'@weasel-js/audio': patch
---

Expose the engine's `AudioContext` as `engine.context`

`register(buffer)` takes an `AudioBuffer`, and the only way to make one is
`ctx.createBuffer(...)`. An engine that created its own context — the default —
never handed it out, so a consumer synthesizing or recording audio had to
construct the context themselves and pass it as `createAudioEngine({ context })`,
which also made them responsible for closing it.

The context is exposed rather than wrapped in a `createBuffer` passthrough:
procedural audio, analysis and a consumer's own node graph all need the real
thing, and one wrapper would be the first of several.

`dispose()` is unchanged — it closes a context the engine created and leaves an
injected one open — so a reference held past `dispose()` may be a closed
context. `engine.context.state` says which.
