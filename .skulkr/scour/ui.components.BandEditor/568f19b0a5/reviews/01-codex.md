# Review saturation for `ui.components.BandEditor`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 16 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Band selection, button activation, and key routing | 1 | 1 | 0 |
| 2 | Range scaling, limits, and locked spans | 0 | 1 | 1 |
| 3 | Draft cleanup, cancellation, and commits | 0 | 1 | 2 |
| 4 | Quantity tags, ruler coordinates, and snapping | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Activating a band button without changing focus can leave it unselected

[BandStrip.tsx](packages/ui/src/components/BandEditor/BandStrip.tsx#L82) · Pass 1 · Low · Source-traced

Band buttons report selection only on focus or pointerdown. A click activation without either event, such as an assistive technology invoking the button directly, does not select the band. A keyboard activation can also miss when the button is already focused and the controlled selection has since changed. The button exposes `aria-pressed`, but its native activation path does not update the pressed selection.

Source and tests were left untouched.
