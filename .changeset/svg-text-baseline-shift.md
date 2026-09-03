---
'@weasel-js/svg': patch
---

Keep a `baseline-shift` named on `<text>` itself.

SVG allows `baseline-shift` on a `<text>` element and inherits it to the
content, but weasel only read it off `<tspan>` children — so
`<text baseline-shift="super">hi</text>` imported with the shift silently
dropped. Bare text now carries the shift its `<text>` names, and a `<tspan>`
naming its own still wins.

It is the only run-level key with no node-level counterpart to be read into,
which is why it alone went missing.
