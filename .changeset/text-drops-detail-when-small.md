---
'@weasel-js/text-tools': minor
---

A text node small on screen draws its lines as gray bars below 6 px of font size, and nothing below 3 px, instead of its glyphs.

`TEXT_PAINTER` carries `TEXT_LADDER`; text sized in `{ px }` stays in full at every zoom. `paintGreekText` is the bars on their own.

<!-- entry: new api visual perf -->
