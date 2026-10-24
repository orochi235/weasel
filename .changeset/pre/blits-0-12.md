---
'@weasel-js/core': patch
'@weasel-js/animator': patch
'@weasel-js/labkit': patch
---

Depend on `@msb235/blits` 0.12.0, which has no breaking changes from 0.11.0. Its fixes make a single `fn` voice over many subjects, the shape weasel's animator uses, cheaper per frame.
