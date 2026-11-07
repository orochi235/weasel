---
'@weasel-js/plot': patch
---

A `logScale` with a base other than 10 labels its powers below 1 with the digits they need. A base-2 scale's 0.125 and 0.25 used to read `0.1` and `0.3`.
