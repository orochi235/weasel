# Review saturation for `text-shaping`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 5 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Script splitting, bracket pairing, and direction | 0 | 0 | 1 |
| 2 | Feature and language validation across the HarfBuzz boundary | 1 | 1 | 0 |
| 3 | Glyph order, UTF-16 clusters, and outline coordinates | 0 | 1 | 1 |
| 4 | Load retry, runtime selection, and cache behavior | 0 | 1 | 2 |
| 5 | Exports and fixture coverage | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. OpenType feature validation silently accepts a truncated setting

[shaper.ts](packages/text-shaping/src/shaper.ts#L123) · Pass 2 · Low · Source-traced

The ASCII check accepts U+0000. The vendored `Feature.fromString` passes a null-terminated buffer to HarfBuzz with length `-1`, so a feature string with a valid tag followed by U+0000 and trailing text is parsed as the tag alone. `shape` applies that feature instead of reporting the invalid setting, and still caches the result under the full JavaScript string.

Source and tests were left untouched.
