---
"@weasel-js/core": patch
---

Additive. A `ShaderDrawCommand` can fill an array uniform from one value: key
it by the array's bare name and pass a flat `number[]`, `Float32Array`,
`Int32Array` or `Uint32Array` — `u_ripples: [x, y, t, x, y, t]` fills
`uniform vec3 u_ripples[8]` from slot 0 in one `uniform3fv` call. The call is
picked from the declared element type (`float`/`vecN`, `int`/`ivecN`,
`bool`/`bvecN`, `uint`/`uvecN`, and every `matN`/`matNxM`). A value that is not
a whole number of elements, or is longer than the declaration, throws in dev; a
shorter one leaves the remaining slots as they were. Per-slot keys
(`u_ripples[2]`) keep working. Effects passes take the same values.
`ShaderUniform` widens to include those array types.

Re-registering a program id with new source in dev now reaches every renderer
that compiled it: the renderer recompiles on its next frame, deletes the
program it replaces and looks its uniforms up again. If the new source fails to
compile, it logs the error once and keeps drawing the previous program. A
`<Canvas shaders>` naming the id repaints when its source changes, so the edit
shows up without anything else asking for a frame.
