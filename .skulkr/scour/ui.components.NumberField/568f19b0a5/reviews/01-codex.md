# Review saturation for `ui.components.NumberField`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the ten files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Form serialization, disabled states, and mixed values | 1 | 1 | 0 |
| 2 | Wheel focus, document boundaries, and event cancellation | 1 | 2 | 0 |
| 3 | Typing, offsets, idle commits, and IME keys | 0 | 2 | 1 |
| 4 | Step repeat, pointer release, and bounds | 0 | 2 | 2 |
| 5 | React Aria state, label wiring, and control layout | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Disabled unit fields still submit their hidden form value

[UnitField.tsx](packages/ui/src/components/NumberField/UnitField.tsx#L144) · Pass 1 · Low · Source-traced

When given `name`, the component submits through a separate hidden input that never receives disabled state. A named `UnitField` disabled directly or by the kit's disabled scope still appears in `FormData`, unlike a disabled native form control. A read-only field can legitimately remain in the submission, so the two states matter here.

### 2. A focused unit field in a shadow root cannot step with the wheel

[UnitField.tsx](packages/ui/src/components/NumberField/UnitField.tsx#L257) · Pass 2 · Low · Source-traced

The wheel handler compares the input with the ambient document's active element. For an input focused inside a shadow root, that document reports the shadow host. The handler treats the input as unfocused and lets the wheel scroll even when the field has room to step.

Source and tests were left untouched.
