# Review saturation for `ui.components.Button`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 15 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | DOM measurement and full-width drawing | 1 | 1 | 0 |
| 2 | Native attributes, forms, and accessibility state | 0 | 1 | 1 |
| 3 | Label clipping, spinner layout, and reduced motion | 0 | 1 | 2 |
| 4 | Close presets, variant icons, and lab export | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A full-width button can measure narrower than it draws

[Button.tsx](packages/ui/src/components/Button/Button.tsx#L221) · Pass 1 · Low · Source-traced

`domButton.measure` converts the props to a face without carrying `fullWidth`, so a regular button with a short label reports its intrinsic width when given a finite maximum and a smaller minimum. In a drawing container of that maximum width, the same props apply `width: 100%`. A host using the measured box to reserve space can therefore leave less room than the drawn button occupies.

Source and tests were left untouched.
