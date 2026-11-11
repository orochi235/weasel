---
"@weasel-js/icons-plugin": patch
---

An app build refuses an icon ref naming an `Object.prototype` member (`core:toString`, `core:hasOwnProperty`) that its table does not hold, as it refuses any other missing glyph. Such a ref had passed the check and reached the bundle naming nothing.
