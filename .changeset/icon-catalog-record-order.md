---
"@weasel-js/icons-plugin": patch
---

An app build reads its icon tables in module id order rather than the order its transforms ran in, so the same modules write the same `virtual:weasel-icons` bytes, and two tables of one namespace disagreeing on a glyph settle on the same one every build.
