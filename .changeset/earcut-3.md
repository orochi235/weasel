---
"@weasel-js/core": patch
"@weasel-js/labkit": patch
---

Path fills tessellate with earcut 3, which handles holes faster. earcut 3 ships its own typings and is ESM-only, as both packages already are.
