---
'@weasel-js/paint': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
'@weasel-js/ui': patch
---

A gradient now names the space its stops blend through. `interpolate` on any of
the three gradient kinds takes `'rgb'` (the default, and what every other vector
format means by a gradient), `'oklab'`, or `'oklch'` — which travels around the
hue wheel, so red to blue stays saturated instead of passing through a muddy
purple. Alpha is linear in every space.

The blend is paid for once, in the 256-texel ramp the shader samples, so a
perceptual gradient costs a batched frame nothing over an sRGB one. The space is
part of the ramp atlas key: the same stops under two spaces take two rows.

`sampleGradientStops` and `sampleResolvedStops` take the space as a third
argument, `bindRamp` as an optional third, and `GradientEditor` grows an
sRGB / OKLab / OKLCh switch (`spaceSwitch={false}` hides it). `@weasel-js/svg`
writes `wzl:interpolate` on the gradient's own element and reads it back; a
renderer that ignores it still paints the gradient, in sRGB.
