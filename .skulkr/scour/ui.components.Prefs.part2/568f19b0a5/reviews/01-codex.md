# Review saturation for `ui.components.Prefs.part2`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 39 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Union variants, sticky headings, and renderer lookup | 0 | 0 | 1 |
| 2 | Controlled selection and scroll state | 1 | 1 | 0 |
| 3 | Drop placeholder paths and value lookup | 0 | 1 | 1 |
| 4 | Split rows and selector option resolution | 0 | 1 | 2 |
| 5 | Commit policy and control wiring | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. An ignored selection event can suppress scrolling for a later external selection

[selection.ts](packages/ui/src/components/Prefs/selection.ts#L133) · Pass 2 · Low · Source-traced

The selection callback sets the local-report marker before notifying the parent. A controlled parent can leave its selection unchanged, so the effect that resets the marker does not run. When the parent later selects a different row externally, the effect still sees the old marker and skips scrolling to the newly selected row. The parent can change the selection successfully while the new row stays outside the visible portion of the form.

Source and tests were left untouched.
