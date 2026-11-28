# Review saturation for `text`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 36 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Locale-aware case mapping across style boundaries | 1 | 1 | 0 |
| 2 | Grapheme, bidi and caret boundaries | 0 | 1 | 1 |
| 3 | Text fitting, canvas measurement and line boxes | 0 | 1 | 2 |
| 4 | Styled range edits, glyph outlines and markdown rendering | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A style boundary can break Turkish lowercase mapping

[textTransform.ts](packages/text/src/runs/textTransform.ts#L114) · Pass 1 · Medium · Source-traced

Turkish lowercase maps capital I followed by combining dot above to one dotted lowercase i. When the I and dot occupy different styled runs with the same language and transform, the empty output piece opens the second run, so piecesOf discards the contextual mapping. The fallback lowercases code points separately, producing dotless i followed by a combining dot instead of the paragraph mapping.

Source and tests were left untouched.
