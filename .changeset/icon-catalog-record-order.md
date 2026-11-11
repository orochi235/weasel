---
"@weasel-js/icons-plugin": patch
---

An app build writes the same `virtual:weasel-icons` bytes from the same modules, whatever order its transforms ran in.

It reads icon tables in module id order, so two tables of one namespace that disagree on a glyph settle on the same one every build.

<!-- entry: fix -->
