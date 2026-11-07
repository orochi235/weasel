---
'@weasel-js/svg': patch
---

`serializeSvg` reports through `onWarn` when a stroke names a marker the marker registry does not know, which it writes without that `marker-*` attribute. It used to leave the head out silently, so `serializeSvg(parseSvg(svg).nodes)` lost a document's own markers with no word unless `parsed.markers` had been registered first.
