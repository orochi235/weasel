---
"@weasel-js/ui-logic": patch
---

`@weasel-js/ui-logic` exports `Span`, a stretch of values a track shows, with `spanPan` and `spanZoom` to move one inside its bounds.

`spanZoom(span, at, factor, bounds, minLength)` scales about `at`, which keeps its place along the track. `spanPlace`, `spanValue` and `spanShare` convert between a value or a length and its fraction of the span, `spanHold` moves a span back inside bounds, and `spanMap(span)` is the span as a `TrackMap`.

<!-- entry: new api -->
