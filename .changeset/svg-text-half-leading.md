---
'@weasel-js/svg': patch
'@weasel-js/text': patch
'@weasel-js/core': patch
---

`serializeSvg` without a `textLayout` now writes a text node's lines where weasel lays them out, for any face the font registry has measured. `dominant-baseline="text-before-edge"` sets the face's ascent on the box top, where weasel's layout first puts half the leading, so every line sat that far off (Inter at 24px: 2.3 up at line height 1.4, 2.5 down at 1.0); a `dy` on the `<text>` now moves them by it. A face nothing measured is written as before. New in `@weasel-js/text`, re-exported by core: `halfLeadingFor(family, weight, style, fontSize, lineHeight)`.
