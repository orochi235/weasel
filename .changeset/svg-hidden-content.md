---
'@weasel-js/svg': patch
---

`parseSvg` ignored `display` and `visibility`, so a layer saved hidden (`<g display="none">`, `style="display:none"`, `visibility="hidden"`) imported as ordinary visible content. An element with `display: none` is now left out with everything under it, and a shape, text, or image whose inherited `visibility` is `hidden` or `collapse` is left out unless it sets `visible` itself.
