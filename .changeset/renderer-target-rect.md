---
'@weasel-js/core': patch
---

`WeaselRenderer` can draw into a rect of a buffer it does not own.
`setTarget({ origin, clear })` applies a viewport and scissor inside `render()`,
so N renderers can share one WebGL context and one canvas without a frame clear
erasing a co-tenant. The rect's size is the renderer's own `width`/`height`, so
`resize()` remains the single source of it.

Adds API. Two behaviour changes for existing callers: `render()` now
re-establishes blend, depth, cull and clear colour every frame instead of once at
construction, so a co-tenant moving that state no longer corrupts weasel's
frames; and the constructor now throws when handed a WebGL2 context whose
attributes report no stencil buffer, which previously rendered clips and even-odd
fills wrong rather than failing. A context that cannot report its attributes is
unaffected.
