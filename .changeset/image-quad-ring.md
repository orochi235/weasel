---
'@weasel-js/core': patch
---

An image quad no longer mints and frees a vertex array and two buffers on every
draw. The renderer keeps a ring of quad geometry per image program instead, and
a draw writes its four corners into the next slot. On an M2 Max via ANGLE this
takes an image command from ~7.0 us to ~3.9 us, measured by
`tests/perf/image-quad.spec.ts`; nothing about the API or the pixels changes.

A ring rather than one buffer, because one is the worst of the three shapes. The
driver tracks a write hazard per buffer object, so rewriting a single quad
buffer before each draw waits on the draw still reading it — 40–80 us per quad
against 5.4 for the per-draw allocation this replaced and 0.3 for the ring.
Sixty-four slots put that many draws between one write of a buffer and the next.

The remaining gap to a pattern-filled rect of the same size (~2.3 us) is texture
state, not geometry: an image binds a different texture and sets its filter per
draw.
