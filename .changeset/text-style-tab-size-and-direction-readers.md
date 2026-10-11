---
'@weasel-js/text': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

`TextStyle.tabSize` sets the distance between tab stops for a text node, in spaces (default 8). It reaches the painter, `layoutTextPose`, `measureTextBounds`, and the edit overlay's CSS `tab-size`, and `@weasel-js/svg` keeps it in `data-weasel-tab-size`. `measureText` and `layoutMarkdown` leave a hanging tab out of a wrapped line the way they leave out a hanging space.

`@weasel-js/svg` reads a `<text>` another writer left without a `direction` as `ltr`, which is what SVG means by it; text weasel wrote keeps an omitted direction as the text's own.
