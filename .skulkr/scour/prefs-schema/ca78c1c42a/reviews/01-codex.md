# Review saturation for `prefs-schema`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 31 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Unit conversion, display limits and suffix round trips | 2 | 2 | 0 |
| 2 | Stored repair, number constraints and composite leaf defaults | 0 | 2 | 1 |
| 3 | Condition evaluation, status walks and encoded values | 0 | 2 | 2 |
| 4 | Scope selection, nested writes and schema path contracts | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Unit precision above the formatter limit crashes display conversion

[unit.ts](packages/prefs-schema/src/unit.ts#L110) · Pass 1 · P2 · Source-traced

Create a linear unit with scale 1 and places 101, which the schema editor's Unit places control accepts as a nonnegative integer. Calling the resolved unit's toDisplay invokes toFixed(101) and throws RangeError. The resulting schema cannot reliably render the edited field.

### 2. A custom display suffix can silently take another unit's conversion

[unit.ts](packages/prefs-schema/src/unit.ts#L148) · Pass 1 · P3 · Source-traced

Create a metric preference unit displaying centimeters and choose mm as its custom suffix. The initial accepted suffix mapping says mm has factor 1 in shown units. The loop replaces it with the system's millimeter-to-centimeter factor of 0.1. A value formatted in the display unit with the chosen suffix reads back at one tenth of its original magnitude. The builder should reject the ambiguous suffix or preserve the announced display conversion.

Source and tests were left untouched.
