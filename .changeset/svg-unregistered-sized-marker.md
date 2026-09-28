---
"@weasel-js/svg": patch
---

`parseSvg` keeps a sized marker reference (`{ key, size }`) whose key the importing session has not registered. The document's `<marker>` def comes back in `ParseResult.markers` under that key, in marker units, so registering it (as `unpackSvgFiles` does) draws the same head. It used to import as an anonymous document marker, losing the key and the size.
