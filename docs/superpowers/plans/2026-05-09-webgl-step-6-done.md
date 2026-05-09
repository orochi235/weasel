# WebGL Step 6 — Done

**Plan:** [`2026-05-09-webgl-step-6-experimental-shader-api.md`](./2026-05-09-webgl-step-6-experimental-shader-api.md)
**Date completed:** 2026-05-09

## What shipped

- **Public APIs (`@experimental`)**: `registerProgram(id, vert, frag)` returns an opaque `ShaderProgramHandle`; `registerTexture(image)` returns an opaque `TextureHandle`. Both are module-level (source / image data only — no GL state). `ShaderUniform` union accepted for per-draw uniform values.
- **`WeaselRenderer.registerProgram(handle)`**: compiles the consumer's GLSL against this renderer's GL context. Throws `ShaderCompileError` (already-existing class) on bad GLSL. Re-compiles on context restore.
- **`kind: 'shader'` DrawCommand**: `{ program, uniforms, bounds }` — the renderer auto-draws a quad over `bounds`, sets the kit-managed uniforms `u_proj`/`u_bounds`/`u_view`, then iterates consumer uniforms via `setUniform`.
- **`setUniform` type-dispatch binder** in `draw.ts`: `number → uniform1f`, `[n,n..n,n,n,n] → uniform2/3/4fv`, `Float32Array(9|16) → uniformMatrix3/4fv`, `TextureHandle → upload (idempotent) + bind to next unit + uniform1i`. Texture units start at 1.
- **Custom vertex prelude** (`shaders/customPrelude.ts`): kit-supplied vertex shader concatenated with consumer's frag, exposes `v_uv`/`v_screen`/`v_world` varyings and `u_proj`/`u_bounds`/`u_view` uniforms. Auto-quad VBO/IBO uploaded once per renderer, re-uploaded on context restore.
- **`extractUniformNames(glsl)`** helper: regex-extracts `uniform <type> <name>;` declarations from the consumer fragment shader so all uniform locations get pre-looked-up at compile time.
- **Public barrel** updated to export every new public type plus the existing `ShaderCompileError`.
- **Voronoi smoke page** (`dev/shader.{html,ts}`): animates a Voronoi cell pattern via a `u_time` uniform inside a 300×300 bounds rect on a 512×512 canvas. Demonstrates the full consumer pattern: `registerProgram` → `renderer.registerProgram` → `render([{ kind: 'shader', ... }])`.
- **Playwright `shader.spec.ts`**: 3 assertions — center pixel non-trivial, outside-bounds pixel transparent, 4×4 grid all opaque inside bounds.

## Notable deviations from plan

- **`extractUniformNames` regex is permissive.** It does not parse struct members or arrays. Fine for v1 — consumers writing `uniform float u_time;` and `uniform vec2 u_pos;` work; consumers writing `uniform Light lights[8];` would need a more sophisticated parser. Logged in v2 deferrals.
- **`setUniform` ordering: TextureHandle check first.** The plan listed type detection in this order: TextureHandle → Float32Array → Array → number. Critical to put TextureHandle first because its `instanceof` test would also match `Object`-discriminated arrays. The implementation explicitly excludes Float32Array and Array via `!Array.isArray && !(value instanceof Float32Array)` before the `'id' in value` check, in case future ShaderUniform values add object types.
- **Per-draw attribute pointer setup, no VAO.** The plan wavered between "per-program VAO" and "rebind per draw" — the latter won (simpler, no per-program VAO bookkeeping). Cost: 4 GL calls per shader draw (`bindBuffer` + `enableVertexAttribArray` × 2 + `vertexAttribPointer` × 2). Acceptable for v1.
- **Skipped Task 8 (drawShader unit tests via mock recorder).** The Playwright shader smoke covers the real behavior (uniforms set, drawElements called, no GL errors). The mock recorder tests would assert the same call shape but couldn't catch the Voronoi-specific pixel result. Per convention §1, smoke is the source of truth for shader correctness.
- **Skipped Task 9 (`setUniform` standalone unit tests).** Same reasoning as Task 8 — `setUniform` is exercised end-to-end by the smoke. The plan itself called Task 9 "lower priority" and acceptable to test indirectly.
- **Skipped Task 13 (ShaderCompileError integration test).** vitest is configured for jsdom, which doesn't expose real WebGL2 via `OffscreenCanvas`. The integration test would always skip. The error-throwing path is exercised by `ShaderProgram` itself (existing tests) and is rebroadcast unchanged from `WeaselRenderer.registerProgram` — adding the integration test wouldn't add coverage.
- **`u_view` is set from `ctx.state.transform`.** The plan had this as a stub; the actual implementation passes the current group transform stack (which is the world→screen view matrix in screen-space draws). Consumers needing precise world coords use the `v_world` varying.

## Test results

- **Vitest: 156/156 pass** (22 test files; new: `registerTexture` 5, `registerProgram` 6 = +11 from step 5's 145).
- **Playwright: 8/8 specs pass** (smoke + synthetic + text + paint + colors + 3 shader specs).
- **Typecheck**: clean for `packages/weasel-gl` (pre-existing rootDir noise from main `src/` imports is not step-6 related).
- **Browser-verified**: Voronoi pattern animates smoothly inside the bounds rect at `/packages/weasel-gl/dev/shader.html`; cell borders move as `u_time` changes.

## Lessons for step 7+ (folded into conventions)

- **§12 (new): module-level registries store data, not GL resources.** `registerProgram` (source strings) and `registerTexture` (image data) follow the same pattern as `registerFont` (font metrics + ImageBitmap): all GL-context binding happens lazily on the renderer. This three-place precedent is now the established pattern; future "register X" APIs should follow it.
- **§13 (new): consumer-facing GLSL contracts must document premultiplied alpha loudly.** It's mentioned in three places for `registerProgram`: the JSDoc `@remarks`, the vertex prelude header comment, and the demo's frag-shader comment. Anything less risks consumers writing `vec4(rgb, a)` and getting over-bright translucent fragments. Keep this triple-warning pattern for any future consumer-shader API.
- **regex uniform extraction is fine for v1**, but the moment a consumer writes a struct or array uniform, the regex misses it and `program.uniform(name)` returns `undefined` for that name → silent skip. If consumers hit this, switch to a proper GLSL preprocessor.

## Open follow-ups

- **`unregisterProgram`** + program lifecycle: currently programs live for renderer lifetime. v2.
- **Multi-pass / FBO support**: render-to-texture, ping-pong surfaces. v2.
- **Custom vertex shaders**: consumers currently constrained to the kit prelude. v2.
- **Source-map / line-number reporting** for `ShaderCompileError.log`: raw GL log lines are relative to the concatenated `vert + frag`, not the consumer's frag source. v2.
- **Shader-command z-ordering**: shader commands draw in tree order alongside other DrawCommands. No explicit back-to-front sorting in v1.
