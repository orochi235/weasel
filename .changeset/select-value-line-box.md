---
'@weasel-js/ui': patch
---

Stop a Select trigger clipping its own text. The value needs `overflow: hidden`
for its ellipsis, which makes the line box a clip — and it inherited
`line-height: 1` from the trigger, so a 13px box held 16px of glyph and sliced
the ascenders and descenders off every label. It now sets `line-height: normal`,
the font's own leading, which fits inside the control at all three densities.
