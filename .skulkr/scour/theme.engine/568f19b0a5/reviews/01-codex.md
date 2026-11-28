# Review saturation for `theme.engine`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean. Scope is the 28 files listed for `theme.engine` in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Axis and pin settlement, inheritance, and reference typing | 0 | 0 | 1 |
| 2 | DTCG export paths, variant groups, and consumer resolution | 1 | 1 | 0 |
| 3 | Palette naming, anchor ordering, and feasibility reporting | 0 | 1 | 1 |
| 4 | Baked selection fallback and generated artifacts | 0 | 1 | 2 |
| 5 | Semantic resolution and diagnostic propagation | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. DTCG aliases can point to the wrong type group for a variant

[emit/dtcg.ts](packages/theme/src/engine/emit/dtcg.ts#L62) · Pass 2 · Low · Source-traced

The exporter chooses the alias target's type from its first axis branch. It emits the target itself under the type of the leaf selected for each variant. If a token is `number` in one mode and `dimension` in another, an alias in the latter mode can still point to the `number` group, even though that mode stores its target under `dimension`. A reader following literal DTCG paths cannot find the target in that mode. Weasel's flat reference resolver drops the group prefix, so its own resolution does not exercise this path lookup.

Source and tests were left untouched.
