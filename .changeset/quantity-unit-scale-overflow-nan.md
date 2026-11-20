---
'@weasel-js/quantity': patch
---

A typed number whose unit scales it past the range of a number, such as `1e308ft` shown in inches, reads as NaN rather than an infinity.

This holds in `unit()`, `bytes()`, and `duration()` fields and in `parseNumber`.

<!-- entry: fix -->
