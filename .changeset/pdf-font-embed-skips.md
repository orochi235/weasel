---
'@weasel-js/pdf': minor
---

A PDF lists a face its font source threw on, or a malformed TrueType face, in `skipped` with the error.

The entry is a `PdfSkip` of the new kind `'font'`, and the face's text is still drawn as outlines. `exportRegionsPdf` reports these as `font` diagnostics.

<!-- entry: api fix -->
