---
'@weasel-js/quantity': minor
'@weasel-js/ui': patch
---

The band-list model `BandEditor` edits is exported from `@weasel-js/quantity`: `Band`, `bandBounds`, `splitBands`, `mergeBand`, `scaleEdges` and the rest.

A new `bandIndexAt(bands, value, min, max)` gives the band a value falls in. `BandEditor` reads the model from
there, and `@weasel-js/ui/components/BandEditor` still exports the `Band` type.

<!-- entry: api -->
