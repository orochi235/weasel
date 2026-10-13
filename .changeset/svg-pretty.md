---
'@weasel-js/svg': patch
---

Fixes: `serializeSvg`'s `pretty` option did nothing. It now puts each element on its own line, indented two spaces per level. A `<text>` element, and any element holding character data, stays on one line, since whitespace added inside it would be read back as content. This changes the output of every caller that already passed `pretty: true`; without the option the output is unchanged.
