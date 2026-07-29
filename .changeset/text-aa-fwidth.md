---
"@weasel-js/font": minor
"@weasel-js/core": minor
---

Text antialiasing is derived from the screen-space derivative instead of a
constant.

Both SDF text shaders computed their smoothstep band from a fixed `u_aaWidth`
(0.05, set once per draw). A constant band cannot be correct at more than one
scale: at 16px it collapsed to well under a screen pixel, so glyph coverage
quantized to all-or-nothing and edges rendered as hard stair-steps; at display
sizes the same constant read mushy. `TEXT_FRAG_SRC` and `TEXT_FRAG_R8_SRC` now
take the band from `fwidth(sdfVal)`, which folds in font size, zoom, and DPR
together, with a small floor so a degenerate derivative can't reproduce the
aliased behavior.

This changes how all GL-rendered text looks — most visibly at UI sizes, where
it is the difference between binary and antialiased edges.

Breaking, for anyone driving the shaders directly:

- `u_aaWidth` is gone from both fragment sources and from `TEXT_SDF_UNIFORMS`.
  There is no CPU-side AA knob to set; the shader derives it. Setting the
  uniform was never useful — the kit only ever wrote 0.05 to it.
