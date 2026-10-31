---
'@weasel-js/renderer': patch
---

An inside- or outside-aligned stroke on a fill that is not convex now stays in the batch: its ribbon
is cut on the CPU against the fill's triangles, where it used to end the run and draw through a
stencil pass. A fill that draws through the stencil itself, a fill whose triangles would take too long
to cut against (a many-pointed star of a few hundred edges, say), and a stroke with per-vertex colors
still take the stencil.
