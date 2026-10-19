---
"@weasel-js/text": patch
"@weasel-js/geom": patch
"@weasel-js/svg": patch
"@weasel-js/core": patch
---

Synthetic-bold text reaches the outline tier. Past the outline threshold, a glyph faked bold from a
lighter face used to stay on the distance field; it is now drawn as geometry, its outline grown by
the distance the field's threshold shift moves the edge, so it is as heavy on either side of the
threshold. A stroked synthetic-bold run, which stayed on the atlas unstroked, is now stroked. A
grown glyph's `LaidOutOutlineGlyph.d` holds the grown outline, and its `key` names the growth.

`@weasel-js/geom` gains `pathToD`, the inverse of `pathFromD`, also exported from `@weasel-js/core`.
`@weasel-js/svg`'s `serializePathD` is now that function.
