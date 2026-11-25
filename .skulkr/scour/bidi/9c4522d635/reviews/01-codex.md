# Review saturation for `bidi`

Snapshot `9c4522d63555ec5f264441bcef4cd6a1917eac02`. Scope is the 11 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Conformance fixture parsing and scalar validation | 1 | 1 | 0 |
| 2 | Paragraph direction, explicit overrides, and isolate overflow | 0 | 1 | 1 |
| 3 | Isolating run construction, weak types, and bracket pairing | 0 | 1 | 2 |
| 4 | Line-level resets, visual reversal, and generated table lookup | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. The conformance parser silently transforms malformed scalar tokens

[parseConformance.ts](packages/bidi/src/__fixtures__/parseConformance.ts#L99) · Pass 1 · Low · Source-traced

Number.parseInt accepts a hexadecimal prefix, so a token such as 0061junk enters the test as U+0061. The integer check also accepts values outside the Unicode scalar range. Malformed fixture input can silently exercise a different character instead of surfacing a parse failure.

Source and tests were left untouched.
