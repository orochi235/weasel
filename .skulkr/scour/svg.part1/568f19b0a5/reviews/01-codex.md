# Review saturation for `svg.part1`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean at the start of review. Scope is the 47 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Root container styling and traversal | 1 | 1 | 0 |
| 2 | Inherited visibility in nested text spans | 1 | 2 | 0 |
| 3 | Geometry length parsing and fallback | 1 | 3 | 0 |
| 4 | CSS cascade order, conditions and viewport calculation | 0 | 3 | 1 |
| 5 | Gradient stops, marker definitions, image and paint serialization | 0 | 3 | 2 |
| 6 | Transform baking, group paint inheritance and draft lowering | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Import drops opacity on the outer SVG element

[parse.ts](packages/svg/src/parse.ts#L107) · Pass 1 · Medium · Source-traced

The reader derives the root style for inherited properties, then passes the children directly to parseChildren. Opacity is not inherited, and no container is made to apply the root's opacity. The nested SVG path does create an opacity group, so moving the same opacity to the outer element changes the imported result.

### 2. A visible grandchild tspan is suppressed inside hidden text

[hiddenElement.ts](packages/svg/src/hiddenElement.ts#L17) · Pass 2 · Medium · Source-traced

The visibility precheck inspects only immediate tspans. When an immediate tspan inherits hidden and an inner tspan sets visible, the precheck drops the entire text before the recursive stretch reader can resolve the visible inner run.

### 3. Malformed geometry lengths can bypass the configured fallback

[lengths.ts](packages/svg/src/lengths.ts#L101) · Pass 3 · Low · Source-traced

The length reader first matches a complete numeric token with an optional unit, but a failed match falls back to parseFloat. An attribute with a valid numeric prefix followed by malformed trailing text is accepted as that prefix, so the caller's fallback and unit diagnostics are bypassed.

Source and tests were left untouched.
