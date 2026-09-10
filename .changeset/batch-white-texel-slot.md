---
"@weasel-js/core": patch
---

Fix solid fills coming out multiplied by whatever bitmap shared their batch.
A solid vertex carried the UV of a 1x1 white texel, but the flush bound the
run's *image*, so any solid staged alongside an image quad sampled that bitmap
at its middle texel instead. A wall of thumbnails is a ground rect under an
atlas quad per cell — the shape the merged batch exists for — so its grounds
came out tinted by the atlas: white drew olive. Reported from outside the repo
against a canvas2d reference; no visual baseline caught it, because in every
demo the quad covers its ground.

Every batch vertex now names the texture slot it samples. Slot 0 is always the
white texel, so a solid's `texture() * a_vertexColor` is the vertex color
exactly whatever else joins its run, and bitmaps take the slots above it.

That also lets one run hold up to seven distinct bitmaps. A document with a
handful of loose images used to break its run on every change of bitmap; now it
breaks only when the slots run out, or when one bitmap is drawn at two
MAG_FILTERs, which is state on the texture object and cannot be had both ways
in one draw.

`tests/visual/batch-pixels.spec.ts` reads the framebuffer channel by channel
rather than diffing a screenshot, which is what it takes to see a run's
composition at all.
