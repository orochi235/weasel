---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

weasel-ui gains `TokenPanel`, which edits a set of design tokens by type. It files
tokens into collapsible sections (Color, Type, Size, Motion, Depth, Other), draws a
color group of three or more as one row of swatches sized to fit — picking a swatch
opens that token's editor — and gives each type its control: a number that keeps its
unit for dimensions, durations and numbers, the nine weights for a font weight, a
curve beside a `cubic-bezier()`, a swatch beside a color, and text for the rest. An
overridden token offers Reset. `tokenCategory` and `inferTokenType`, which reads a
DTCG type off a value, are exported beside it. labkit re-exports all of them.

forge's CSS Vars panel is now a `TokenPanel`. The Theme tab takes each token's type
and group from the theme's manifest; the Story tab uses the manifest for a token it
knows and infers the rest, and which sections are collapsed persists with the lab.
