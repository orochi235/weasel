---
'@weasel-js/theme': patch
---

Token and step names are limited to letters, digits, `-` and `_`. Any other name is reported as invalid and dropped, as a name containing a dot already was; a quote in a name used to reach the generated `themes.ts` unescaped.

`@weasel-js/theme/engine` also exports `bakeChain(definition, lookup)`: the definition and every theme it extends, baked, root first.
