---
'@weasel-js/ui': minor
---

A `SpanStrip` span takes `track` and `trackSpan`, so spans running at once can share a strip as stacked stripes.

A strip whose spans name more than one track splits its height into that many stripes, and each track chains its own spans. A span covering several tracks, as a table cell's `rowSpan` does, starts after the latest end on any of them. A stripe's label shrinks to fit when the stripe is shorter than the strip's text.

<!-- entry: new api -->
