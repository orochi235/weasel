---
'@weasel-js/font': patch
'@weasel-js/text': patch
---

`layoutRuns` no longer warns "no metrics for …" about a face whose registration is still loading — an un-awaited `registerFont`, or an outline face whose bytes have not arrived. It warns once that registration settles and the face still resolves to nothing. New `fontPending(family, weight?, style?)` answers whether a registration in flight could still serve a request. A failed `registerFont` or outline load now fires `subscribeGlyphReady`, so text laid out while it was pending gets laid out again.
