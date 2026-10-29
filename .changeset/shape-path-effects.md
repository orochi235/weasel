---
'@weasel-js/geom': patch
'@weasel-js/core': patch
'@weasel-js/path-tools': patch
---

Three live path effects of one shape: Roughen, Zigzag, and Pucker & Bloat. geom adds the math as `roughenPath`, `zigzagPath`, and `puckerBloatPath`, each with its options type. Core adds `RoughenEffect`, `ZigzagEffect`, and `PuckerBloatEffect` to `PathEffect`: a path-effect node of one of these kinds has one source, `[shape]`, and paints it changed in its own fill and stroke. path-tools adds `roughenAction` (Alt+Shift+G), `zigzagAction` (Alt+Shift+Z), and `puckerBloatAction` (Alt+Shift+K) to `pathEffectsPreset`, each with a `path-tools:` glyph. Each makes one effect of every selected shape, just over it, and hides the shape while the effect shows it; Edit Path Effect, Expand to Paths, and Release work on them as on the others. This adds API.
