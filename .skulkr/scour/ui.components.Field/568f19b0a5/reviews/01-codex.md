# Review saturation for `ui.components.Field`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the ten files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Native label association and control IDs | 1 | 1 | 0 |
| 2 | Conditional slots and invalid-state reporting | 1 | 2 | 0 |
| 3 | Group naming and nested scope isolation | 0 | 2 | 1 |
| 4 | React Aria adapter and validation-state precedence | 0 | 2 | 2 |
| 5 | Field layout, control sizing, and exports | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A control with its own ID loses native label activation

[Field.tsx](packages/ui/src/components/Field/Field.tsx#L63) · Pass 1 · Low · Source-traced

A single `Field` renders its label with `htmlFor` set to a generated ID. If its child supplies an explicit ID, `useFieldControl` gives that ID precedence without updating the label target. A labeled `Input` with a caller-supplied ID can retain its accessible name through `aria-labelledby`, but clicking the visible label does not focus the input because the native association points elsewhere.

### 2. A boolean true slot creates phantom field content and can mark a valid input invalid

[fieldSemantics.tsx](packages/ui/src/components/Field/fieldSemantics.tsx#L125) · Pass 2 · Low · Source-traced

React renders both boolean values as empty content, but `shows` excludes only false. A conditional expression that yields `true` for a valid field, such as `error={valid || 'Invalid value'}`, creates an empty error element, sets the invalid state, and adds an accessibility description pointing at the empty error slot.

Source and tests were left untouched.
