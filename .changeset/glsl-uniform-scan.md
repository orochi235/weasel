---
'@weasel-js/core': patch
---

A registered program's struct uniforms now get locations. `uniform Light
u_lights[2];` is looked up as `u_lights[0].pos`, `u_lights[0].r` and so on,
nested structs and array members included; before, only the bare name was
looked up, so every write to a struct member was dropped, with a warning only
in development.

Array sizes written as a `#define`, a top-level `const int`, a small integer
expression over those, or on the type (`uniform float[2] u_t;`) now resolve;
before, such a uniform got no locations at all. Uniforms inside comments are no
longer looked up.

A program recompiled after a restored WebGL context now looks up the uniforms
its own vertex shader declares, as `registerProgram` already did.
