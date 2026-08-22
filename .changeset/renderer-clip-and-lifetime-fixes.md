---
'@weasel-js/core': patch
---

Fix four renderer bugs found in a review of `packages/core/src/renderer`.

- A stroke carrying per-anchor `vertexColors` never set the stencil test
  before its draw. Inside a clipped group it ignored the clip and wrote clip
  bits of its own; drawn after a clipped group it was tested against a bit
  that had just been cleared and disappeared entirely.
- `GroupState` was never reset between frames, so a frame that threw part-way
  down the tree (the max-7 clip nesting error, for one) left every enclosing
  group's transform, alpha and color matrix on the stack and shifted every
  later frame.
- `dispose()` never deleted the pattern-fill program.
- `GLTextureCache` applied a texture's wrap mode on first upload only, so a
  registered image used as both a clamped shader texture and a repeating
  pattern tile got whichever mode reached it first.

Also: re-registering a custom shader program on a renderer now deletes the
program it replaces instead of orphaning it.
