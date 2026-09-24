---
'@weasel-js/paint': patch
---

A `Palette` type: named entries whose colors are literals in any color space (`{ space, coords, alpha? }`), refs to other entries or to an outside lookup (`{ ref, index? }`), or functions computed at resolve time. An entry may instead hold `colors`, a factory such as a `function*` that yields a sequence, possibly endless, read lazily. `resolvePaletteColor` follows refs to a literal, `resolvePaletteColors` iterates one entry, and `colorLiteralToHex` converts `srgb`, `oklab` and `oklch` literals to hex.
