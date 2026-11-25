# Review saturation for `diagram.outlines`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 11 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Custom path validation and move-only subpaths | 1 | 1 | 0 |
| 2 | Content placement versus modeling glyph geometry | 1 | 2 | 0 |
| 3 | Built-in shape content sizing and inverses | 0 | 2 | 1 |
| 4 | Path and detail generation across outlines and aspect ratios | 0 | 2 | 2 |
| 5 | Outline registry shadowing and fallback behavior | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A move followed by close passes empty-outline validation

[fromD.ts](packages/diagram/src/outlines/fromD.ts#L13) · Pass 1 · Low · Source-traced

Call outlineFromD with `M0 0 Z`. The parser records a move and close, but there is no segment with geometry. The validator only rejects a list made entirely of move commands, so it returns an outline that draws nothing instead of throwing as documented.

### 2. The component outline can place content under its UML icon

[modeling.ts](packages/diagram/src/outlines/modeling.ts#L33) · Pass 2 · Low · Source-traced

For a 60×100 component, the icon is full size and reaches 29 units inward from the right edge, to x=31. The content box reserves only width/4, so it ends at x=45 and overlaps the icon in the top rows. This can cover text in a fixed-width component even though the content inset is intended to keep it clear.

Source and tests were left untouched.
