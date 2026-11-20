I couldn't write `.skulk/out/findings.md` because permission to write it was denied, so the whole findings document is below. One more thing: the checkout's HEAD is `830b463cc1`, not the frozen commit `608f35f…` named in the brief. All line numbers are from that tree.

## A released program registration keeps drawing on every renderer that compiled it, and its GPU program is never freed until dispose
- where: packages/renderer/src/shaders/CustomPrograms.ts:86 (refresh), :107 (ensure)
- scenario: `const off = programSourceRegistry.register('stripes', src)`. A renderer draws with `stripes`, which compiles it. Then `off()` removes the source from the registry. `refresh()` skips the id (`if (!src || src === compiled) continue`). `ensure()` returns the cached `registry.get(id)` without checking the source. So the renderer keeps drawing the removed program indefinitely, and its GPU program stays alive until the renderer is disposed. A renderer that never compiled it warns "no program is registered" and draws nothing, so two renderers handle the same draw differently. The compiled copy should be dropped and `deleteProgram`'d once its source is unregistered, as `restore()` already does ("its source is no longer registered").
- evidence: read (a release deletes the id from the store: packages/registry/src/extensionRegistry.ts:84-85)
- severity: medium

## After a context restore, a program whose re-registered source failed to compile stops drawing, though before the loss it kept drawing the previous one
- where: packages/renderer/src/shaders/CustomPrograms.ts:130 (restore) vs :91-96 (refresh)
- scenario: source A is compiled and drawing. Then `registerProgram(id, B, { replace: true })` is called with a B that fails to compile. `refresh()` logs the error, keeps A drawing, and records `sources[id] = B`. The context is then lost and restored. `restore()` compiles only the current source B, fails, and deletes the id, so nothing draws from then on. The documented rule (registerProgram.ts:145, "keeps drawing the old one") holds only until a context loss.
- evidence: read
- severity: low

## A top-level `const int A = 2, B = 3;` records neither constant, so arrays sized by them are dropped from the uniform scan
- where: packages/renderer/src/shaders/extractUniformNames.ts:96-101 (recordConstInt)
- scenario: the shader declares `const int A = 2, B = 3;` and then `uniform vec3 u_pts[B];`. `recordConstInt` evaluates the tokens after `A =` up to `;`, which are `2 , B = 3`. `evalInt` returns null because it does not consume every token, so neither A nor B is recorded. As a result:
  - the declarator for `u_pts` is dropped;
  - every write to `u_pts` or `u_pts[k]` warns and is lost;
  - the uniform stays zero.
- evidence: read
- severity: low

## The id-output rewrite counts `main` and outputs with regexes over the source with comments still in, so a comment mentioning them makes a custom shader unpickable
- where: packages/renderer/src/shaders/idOutput.ts:45-47 (withIdOutput)
- scenario: a custom frag shader has a block comment holding an old `void main() {…}`, or a line comment like `// void main() …`. `count(MAIN, frag)` is then 2, so `withIdOutput` returns null. In an id frame the program then draws with attachment 1 off, and `renderIds` reports nothing under that paint, with no warning. An `out vec4 x;` line inside a block comment does the same thing through `COLOR_OUT`/`ANY_OUT`. The uniform scanner already strips comments with `preprocess` (glslSource.ts); this rewrite does not.
- evidence: read
- severity: low

## Files read
packages/renderer/src/shaders/CustomPrograms.ts
packages/renderer/src/shaders/ShaderProgram.ts
packages/renderer/src/shaders/batchFill.ts
packages/renderer/src/shaders/builtinPrograms.ts
packages/renderer/src/shaders/customPrelude.ts
packages/renderer/src/shaders/extractUniformNames.ts
packages/renderer/src/shaders/glslSource.ts
packages/renderer/src/shaders/glyphCell.ts
packages/renderer/src/shaders/glyphLayer.ts
packages/renderer/src/shaders/glyphPaint.ts
packages/renderer/src/shaders/gradFill.ts
packages/renderer/src/shaders/hullCoverage.ts
packages/renderer/src/shaders/idOutput.ts
packages/renderer/src/shaders/pathFill.ts
packages/renderer/src/shaders/patternFill.ts
packages/renderer/src/shaders/registerProgram.ts
packages/renderer/src/shaders/straightRgb.ts
packages/renderer/src/shaders/trimmedRibbon.ts

<!-- done: 4 findings, files read: 18 -->