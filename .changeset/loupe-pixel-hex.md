---
'@weasel-js/loupe': patch
'@weasel-js/hud': patch
---

`pixelHex` turns an RGBA pixel's bytes into the `#rrggbb` a loupe reports, or `null` for a fully transparent one. A canvas source and the HUD loupe both report colors through it, where each had its own copy.
