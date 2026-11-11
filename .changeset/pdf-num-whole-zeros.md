---
"@weasel-js/pdf": patch
---

The writer's number formatter, asked for no decimals, dropped a whole number's trailing zeros (`100` as `1`) and
wrote a tiny negative as `-`. Nothing in the package asks for no decimals yet, so no file it wrote changes.
