# Review saturation for `diagram.theme`

Snapshot `e368628b3040756c18b348d5f430643e730b71cb`. The tracked working tree was clean at the start of review. Scope is the 10 listed files in the working-tree [Skulkr partition](docs/audits/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Font-family edits and text geometry refresh | 1 | 1 | 0 |
| 2 | Theme file validation, serialization, and editable paths | 0 | 1 | 1 |
| 3 | Role and lane style resolution with manual overrides | 0 | 1 | 2 |
| 4 | Token fallbacks, theme application, and history grouping | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Changing only the theme font family leaves size-dependent body geometry stale

[applyTheme.ts](packages/diagram/src/theme/applyTheme.ts#L50) · Pass 1 · Medium · Source-traced

Apply a theme with a wider font family but the same font size to a body with text. themeWrites updates the row's font family, but writeAll queues body relayout only when fontSize differs. The new face draws into boxes measured for the old one, which can leave text clipped or overlapping until a later relayout.

Source and tests were left untouched.
