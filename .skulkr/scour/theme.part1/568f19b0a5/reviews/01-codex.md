# Review saturation for `theme.part1`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean. Scope is the 28 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Theme application and weighted selection arithmetic | 0 | 0 | 1 |
| 2 | Axis choice identity and its bake caller | 1 | 1 | 0 |
| 3 | DTCG import and inheritance, including override keys | 0 | 1 | 1 |
| 4 | Color-source and palette resolution | 0 | 1 | 2 |
| 5 | CSS number, shadow parsing, and static hook defaults | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Distinct supported axis choices can share a bake key

[axes.ts](packages/theme/src/axes.ts#L115) · Pass 2 · Low · Source-traced

Axis value names can contain commas and equals signs. The key concatenates raw selections using those same delimiters. With axes `a` and `b`, choosing (`x`, `y,b=z`) and choosing (`x,b=y`, `z`) both serialize to `a=x,b=y,b=z`. The bake table stores each selection by that key, so the later row replaces the earlier one and a selection can receive the other selection's tokens. The same delimiter convention in DTCG override keys also permits loss of variant identity.

Source and tests were left untouched.
