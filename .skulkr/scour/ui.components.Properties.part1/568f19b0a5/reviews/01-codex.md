# Review saturation for `ui.components.Properties.part1`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 37 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Enum and curve input contracts | 0 | 0 | 1 |
| 2 | Color edits with a separate opacity value | 1 | 1 | 0 |
| 3 | Number entry, slider bounds, and held controls | 0 | 1 | 1 |
| 4 | Dialog lifecycle and help accessibility | 0 | 1 | 2 |
| 5 | Field composition, group collapse, and layout | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Picking black can leave a mixed or unset color unchanged

[ColorControls.tsx](packages/ui/src/components/Properties/ColorControls.tsx#L47) · Pass 2 · Low · Source-traced

With separately stored opacity and an opacity commit callback, the wrapper only commits RGB when its comparison detects a change. A mixed or unset field with no RGB value gets black as its comparison baseline. An explicit black pick equals that baseline, so the wrapper skips the RGB commit and a controlled field stays mixed or unset. The color field already emits a separate RGB-only value for this kind of pick, allowing the existing opacity to remain intact.

Source and tests were left untouched.
