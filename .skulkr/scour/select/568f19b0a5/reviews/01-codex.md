# Review saturation for `select`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 6 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Range membership and repeated IDs | 1 | 1 | 0 |
| 2 | Modifier precedence, force-single eligibility and anchor transitions | 0 | 1 | 1 |
| 3 | Tree ancestor precedence and root handling | 0 | 1 | 2 |
| 4 | Store notifications, snapshot identity and public exports | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Ordered ranges can put the same ID into a selection twice

[select.ts](packages/select/src/select.ts#L78) · Pass 1 · Low · Source-traced

The custom between route removes duplicate IDs, while the order route returns the slice directly after filtering. If a visible order repeats an ID, both copies can enter Selection.ids and consumers can count or process the same logical item twice. Writing the same result to createSelectionStore silently normalizes it, so the returned selection and stored selection can disagree.

Source and tests were left untouched.
