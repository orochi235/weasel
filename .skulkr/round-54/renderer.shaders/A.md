I couldn't write `.skulk/out/findings.md` because the write permission was declined, so the whole findings document is below.

# Audit round 54: renderer.shaders (blind reviewer)

The brief names commit 608f35f5258a05f095a34c54f949616c26b75022, but that commit isn't in this clone (`git cat-file` reports a bad object). HEAD is 830b463cc1, and every listed file is unmodified at HEAD, so that is the revision I read.

## Re-registering a program that is already compiled from the same source recompiles it and makes every retained surface stale
- where: packages/renderer/src/shaders/CustomPrograms.ts:62-79 (CustomPrograms.register / install)
- scenario: `<Canvas shaders={[a]}>` becomes `shaders={[a, b]}`. `canvasRenderer.ts:331` sees a new shader key and calls `registerShaders`, which calls `renderer.registerProgram` for every handle, `a` included. `register` always compiles, and `install` finds a previous program, deletes it and runs `epoch++`, even though `getProgramSource(id)` is the same source it compiled last time. The result is a wasted compile, and since `epoch` is part of the retained-surface key (`WeaselRenderer.ts:199`), every retained surface repaints. Calling `WeaselRenderer.registerProgram(handle)` twice directly does the same. It should return early when `sources.get(id)` already matches the registered source (`=== src` or `sameProgramSource`), as `refresh` already does.
- evidence: read
- severity: medium

## A released program source keeps drawing: `refresh` skips it, while `restore` drops it
- where: packages/renderer/src/shaders/CustomPrograms.ts:86 (refresh), :107-108 (ensure), :135 (restore)
- scenario: a program registered through `programSourceRegistry.register`, or through a paint kind's `programs` (`paintKinds.ts:160`), is drawn once and compiled. Its release is then called and nothing else holds the id. `refresh` gets `getProgramSource(id) === null` and `continue`s, so the program stays in `registry`. `ensure` returns it without checking the source table, so a `kind:'shader'` command naming the id keeps drawing the unregistered program, and the GL program stays allocated until the renderer is disposed. After a context loss the same state is handled the other way: `restore` throws "its source is no longer registered" and drops the program. `registerProgram`'s doc presents the release as the way to remove a program. `refresh` should delete the compiled copy, as `restore` already does.
- evidence: read
- severity: medium

## `const int A = 2, B = 3;` records neither constant, so arrays sized by either get no locations
- where: packages/renderer/src/shaders/extractUniformNames.ts:96-101 (recordConstInt)
- scenario: the shader has `const int A = 2, B = 3; uniform vec3 u_pts[A];`. `recordConstInt` takes everything from the first `=` up to the `;`, so `evalInt` gets `2 , B = 3`. It returns null because it can't consume every token. A is not recorded and B is never looked at, so `u_pts`'s size can't be resolved and its declarator is dropped. No `u_pts[k]` location and no `u_pts` array entry is looked up, every write goes through `null`, and the uniform stays zero. A declarator list is valid GLSL ES 3.0. The uniform path already handles lists through `declarators`; the const path doesn't.
- evidence: read
- severity: low

## Ramp lookups are off by up to half a texel: `t` is used as the texture coordinate with no texel-center remap
- where: packages/renderer/src/shaders/gradFill.ts:59 (shadePaint); packages/renderer/src/shaders/batchFill.ts:296 (batchFragSrc, radial/conic arm)
- scenario: `buildGradientRamp` writes texel `i` at ramp position `i / (RAMP_WIDTH - 1)` (`GradientRampAtlas.ts:46`), and the atlas filters LINEAR. Both shaders sample `u = t`, which lands on texel coordinate `256t − 0.5`, i.e. ramp position `(256t − 0.5)/255`. That is displaced by `(t − 0.5)/255` of the gradient's length: zero at the middle, close to half a texel at the ends. A hard stop at 0.1 on a 2000 px linear gradient draws about 3 px early. The fix is `u = (t * (RAMP_WIDTH − 1) + 0.5) / RAMP_WIDTH`. The batch's linear path (`linearRampUV`) feeds `t` as `u` straight too, so all paths carry the same shift.
- evidence: read (offset derived from the code, not measured)
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