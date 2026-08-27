---
'@weasel-js/core': patch
---

Draw text from a ring of reused vertex buffers instead of minting a vertex
array and two buffers per draw. `drawTextGroup` and `drawTextDecorations` were
the last paths still doing what `drawImage` stopped doing; text now costs
**3.3 us/command, down from 6.65** at 512 commands a frame on an M2 Max via
ANGLE (`tests/perf/transition-matrix.spec.ts`), which puts it level with an
image draw. No other command kind moved.

A text group is as many quads as it has glyphs, so unlike the image ring a
slot's buffer grows to the largest run it has seen rather than being fixed at
four vertices. The quad index pattern is a pure function of the quad count —
the pattern for N quads is a prefix of the pattern for any larger N — so one
index buffer serves every slot, grown the same way and written only when it
grows.
