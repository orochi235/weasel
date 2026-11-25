# Review saturation for `font.outline`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 15 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Outline registration lifecycle and synchronous subscriber reentrancy | 1 | 1 | 0 |
| 2 | Parsed outline formats and PDF and SVG font embedding dispatch | 1 | 2 | 0 |
| 3 | Font collection selection, name decoding, and WOFF reconstruction | 0 | 2 | 1 |
| 4 | Kerning lookup order, pair tables, and contour serialization | 0 | 2 | 2 |
| 5 | Local font registration, glyph caching, and parser error handling | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A registry subscriber can start the same outline load again before its promise is stored

[outlineRegistry.ts](packages/font/src/outline/outlineRegistry.ts#L277) · Pass 1 · Medium · Source-traced

beginLoad assigns slot.load only after runLoad returns a promise, but runLoad emits the loading update synchronously before its first await. A fontOutlineRegistry subscriber that calls loadFontOutlines for a slot just reported as loading can reenter beginLoad while slot.load is still null. With a one-shot subscriber the source bytes can be parsed twice and readiness published twice. A subscriber that reacts to every loading update keeps reentering.

### 2. CFF2 outlines are advertised to exporters as TrueType

[opentypeParser.ts](packages/font/src/outline/opentypeParser.ts#L185) · Pass 2 · Medium · Source-traced

The parser accepts CFF2. The installed opentype.js stores it under font.tables.cff2, while embeddingOf only tests cff and otherwise reports truetype. A parsed CFF2 font can therefore pass the PDF exporter's TrueType-only check and enter the wrong embedding path. SVG also chooses its embedded font metadata using the same outline classification.

Source and tests were left untouched.
