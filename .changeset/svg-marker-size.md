---
"@weasel-js/svg": patch
---

A marker reference's `size` survives SVG export and import. `SvgStroke.markerStart` / `markerMid` / `markerEnd` are now the kit's `MarkerRef` rather than a bare key, and `svgStrokeFromKit` keeps the size. The serializer writes a sized reference to a `<marker>` def of its own, drawn in user space at that size so any viewer shows it right, and stamps it with `wzl:key` / `wzl:size`, which `parseSvg` reads back as `{ key, size }` when the key is registered. A marker whose entry writes its own def through `toSvg` still goes out at its own size, with a warning.
