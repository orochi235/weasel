---
"@weasel-js/core": patch
---

Lay text out from font bytes alone — no baked atlas.

`registerFontOutlines` was a paint upgrade for a family that already had an
MSDF atlas; a family with only font bytes could not resolve, so it rendered
nothing. It is now a tier in its own right: `OutlineFace` reports `ascender`,
`advanceOf` and `kernOf` in em units, `resolveFontVariant` resolves an
outline-only family, and `layoutRuns` reads advances, kerning and the baseline
through one source the atlas and a parsed face both satisfy. `outlineMinSize`
does not gate such a family — there is no other tier to prefer.

This does not touch metric neutrality where it applies: a family that has an
atlas still resolves to the atlas, so registering outlines cannot move text
that was already rendering.

Also fixes the outline tier in Node. opentype.js publishes ESM under `module`
and UMD under `main`; Node takes the UMD build, whose named exports it cannot
detect, so `parse` was undefined and every face failed to load — silently, via
the fallback to SDF. A browser bundler reading `module` never saw it.

Breaking for a consumer-supplied `OutlineParser`: a face must now report
metrics as well as geometry.
