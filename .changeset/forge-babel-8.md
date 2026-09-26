---
"@weasel-js/forge": patch
---

forge's story indexer parses with `@babel/parser` 8. That parser needs Node `^22.18.0 || >=24.11.0`, so forge's `engines` now says so, where it said `>=22` before.
