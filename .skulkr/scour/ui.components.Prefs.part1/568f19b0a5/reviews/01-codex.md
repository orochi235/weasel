# Review saturation for `ui.components.Prefs.part1`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 40 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Group tab inputs and selection fallback | 1 | 1 | 0 |
| 2 | Split preference member identity and edit routing | 1 | 2 | 0 |
| 3 | List, map, and object entry reconciliation | 0 | 2 | 1 |
| 4 | Form filters, rail navigation, and dialog composition | 0 | 2 | 2 |
| 5 | Action leaves, layout variants, and held states | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. GroupTabs throws when there are no tabs

[GroupTabs.tsx](packages/ui/src/components/Prefs/GroupTabs.tsx#L32) · Pass 1 · Low · Source-traced

The component accepts an array without a nonempty requirement. It reads `tabs[0].id` before handling selection and also dereferences the first tab during rendering. A caller rendering an empty collection, for example after filtering away every tab, gets a render exception instead of an empty strip.

### 2. Split preference rows use display labels as their identity

[SplitRow.tsx](packages/ui/src/components/Prefs/SplitRow.tsx#L120) · Pass 2 · Low · Source-traced

Sibling selector options can have distinct values and the same display label. The split editor keys the terminal rows by that label, giving the two controls duplicate React keys despite their distinct stored selections. If the options change or reorder, React can reuse a row's local input state for a different selector value. The option's stable value, already used to key branch rows, distinguishes the terminal rows as well.

Source and tests were left untouched.
