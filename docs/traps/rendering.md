# Rendering traps

Things in the renderer, shaders and the GL batch that pass every test and are still wrong.

**A visual baseline cannot see a batched run's composition.** The renderer merges
neighbouring commands into one draw, and what a screenshot shows is the topmost
thing drawn — so a wall of thumbnails, whose atlas quad covers its own ground
rect, hides whatever the ground painted. Solid fills spent a day drawing
multiplied by the atlas texel beside them with all 51 baselines green; an outside
consumer found it against a canvas2d reference in an afternoon. Anything that
changes what shares a draw needs `tests/visual/batch-pixels.spec.ts`'s kind of
check — build the command list, read the framebuffer channel by channel, and
probe a pixel the covering command does *not* cover.

**A backtick in a GLSL comment ends the shader.** Every shader in this repo is
a template literal, so a comment written the way the surrounding TypeScript is
— `like this` — closes it and reopens it, and what was between becomes
JavaScript. It does not always fail the typecheck: an even number of them
re-balances into something that parses and then dies at runtime with
`SyntaxError: Expected a semicolon` from an `eval` frame, naming no file. Write
GLSL comments with no backticks at all.

**A uniform with no location is written through `null`, and GL says nothing.**
`gl.uniform*(null, …)` is a legal no-op, so the uniform keeps its zero default —
a zeroed `u_model` collapses every vertex to a point and the draw produces no
fragments at all. `WeaselRenderer.registerProgram` used to scan only the
*fragment* source for uniform names, so a registered program supplying its own
vertex shader got no location for anything it declared there; the mesh paint
bound, baked, drew, and painted nothing, with 31 green unit tests behind it.
The recorder cannot catch this — it answers every `getUniformLocation` — so the
test asserts the renderer *asked* for the name, and the browser is what proves
the pixels. Both stages are scanned now.

**A shader variant a compiler can fold measures nothing.** `fill-rate.spec.ts`
gated its glyph math on `mix(..., u_color.a * 0.0)`, which folds to zero — so
every line feeding that arm was dead and the variant timed the same shader as
its control, reporting the glyph math as free (and sometimes negative). A
runtime zero that is not a compile-time zero (`u_color.a - 0.5` where the
uniform is 0.5) is what keeps the code alive. The same trap waits for any
"with and without" shader pair.

**No gradient is a run-breaker any more.** Linear, radial and conic all ride the
vertices off the ramp atlas and join the run, and so do images and text. A test
reaching for "a paint the batch cannot express" wants per-vertex colors or a
pattern, and should count draws to pin that premise: tests written against the
old behavior went on passing for the wrong reason, twice.

**A path-fill painter's bind half and draw half must stay split.** `applyClipTest`
disables the stencil test at clip depth 0 and overwrites `stencilFunc` otherwise, so any
function owning its own stencil state — `drawPathStrokeStenciled`, `drawPathFillStencil` —
binds with `bindPathFillByKind` and draws itself. Calling `drawPathFillByKind` from either
one paints the full doubled ribbon, or fills the holes of an even-odd path, with every test
green. Write the naive version first and watch the guard test fail before fixing it.

**`tryStageSolid(ctx, mesh, undefined)` flushes the staged run and returns `false`.** Pass
`undefined` for a non-batchable paint rather than hand-rolling a `flushSolids`, or draw
ordering breaks.

**`glRecorder`'s proxy answers to every name.** An ALL-CAPS property the constants table
does not carry comes back as `0`, so an assertion naming a missing flag compares 0 against
whatever else answers 0 and passes on a renderer that never touched it. A lowercase one
comes back as a recording *function*, so a y-flip computed from a mistyped
`drawingbufferheight` is silently `NaN`. Add the constant to `GL_CONSTANTS` first, and
watch the assertion fail before trusting it.

**A bare `getContext('webgl2')` on a shared buffer can cripple every tenant of it.**
Called on a canvas no renderer has opened yet, it creates the context with default
attributes, and the renderer's later `getContext('webgl2', { stencil: true, … })`
gets that same context back without a stencil buffer — every path fill then draws
nothing, with no error anywhere. A labkit surface clear did this to every
annotation mark. Only touch a shared context once a tenant has painted into it. A test's
pixel reader counts: one reading before the app's first paint refuses the canvas
(`weasel: this canvas cannot be painted: … no stencil buffer` on stderr), so a reader
asks for `{ preserveDrawingBuffer: true, stencil: true }`.

**A tile repainted before its position commits leaves a ghost after a clear.**
`<Canvas paintInto>` reads its `x`/`y` from the last render, so a surface painter
that sets React state and then asks for a redraw can paint the tile where it *was*
— after that frame's whole-buffer clear, which nothing then erases.
`AnnotationOverlay` commits the rect with `flushSync` first. A GL trace of
`scissor` against `clear` is what shows it; the screenshot only shows a stray mark.

**A blit out of a multisampled buffer writes past the rect it was given, on ANGLE's
Metal backend.** Resolving the bottom-left tile of a scratch buffer into a surface
larger than it overwrote a band of the neighboring tile with whatever the scratch
buffer held there. It goes unseen while the destination is no larger than the rect,
because the destination's own edge clips the excess, so an untiled retained surface
never showed it. A tile resolves first into a single-sampled copy of the whole scratch
buffer (`resolveInto`, `packages/renderer/src/retain/surfaceGl.ts`), and only that
copy's blit names a sub-rect. `retained.tiles.browser.test.ts` fails without it.
