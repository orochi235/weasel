---
'@weasel-js/core': patch
---

A registered shader program supplying its own vertex shader now gets locations
for the uniforms it declares there. `WeaselRenderer.registerProgram` scanned
only the fragment source, so every vertex uniform was written through a `null`
location — which GL accepts in silence, leaving the uniform at its zero
default. A zeroed `u_model` collapses every vertex to a point, so the program
bound, drew, and painted nothing at all, with no error anywhere.

This is what the `mesh-gradient` paint hit: it is the first thing in the kit to
reach the custom-program path with a vertex stage of its own.
