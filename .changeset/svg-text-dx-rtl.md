---
'@weasel-js/svg': patch
---

SVG import reads a `dx` list on a `<text>` that holds `<tspan>`s as letter spacing, handing each value to the glyph it counts to through the text and every tspan; a tspan's own values replace the text's where it has them. A `dx` or `x` list in right-to-left text is read too, as spacing that narrows the gap a `dx` toward +x closes, where a registered bidi engine says every glyph of the run reads right to left; otherwise it is reported unread, as before. The warning for an unread `rotate` no longer mentions advance.
