# Review saturation for `ui-logic`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the nine files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Shared button parts and DOM adapter inputs | 1 | 1 | 0 |
| 2 | Theme token parsing, control sizes, and baseline arithmetic | 0 | 1 | 1 |
| 3 | List and menu measurement, row gaps, and hit testing | 0 | 1 | 2 |
| 4 | Disabled and read-only precedence, focus contracts, and exports | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A button drops a numeric zero supplied as a leading or trailing decoration

[button.ts](packages/ui-logic/src/button.ts#L39) · Pass 1 · Low · Source-traced

The DOM Button accepts a React node for either decoration and passes it to the shared face unchanged. Zero is renderable by React, but the truthiness checks in `buttonParts` omit that slot. Both the measured width and the rendered button therefore omit an explicitly supplied `0` decoration.

Source and tests were left untouched.
