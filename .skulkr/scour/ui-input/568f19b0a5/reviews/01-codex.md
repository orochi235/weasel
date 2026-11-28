# Review saturation for `ui-input`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 23 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Sweep endpoints and numeric sampling | 1 | 1 | 0 |
| 2 | Keyboard navigation, row order, and disabled targets | 1 | 2 | 0 |
| 3 | Selection edits, solo sweeps, and restoration across renders | 0 | 2 | 1 |
| 4 | Pointer state, reorder gaps, edge scrolling, and wheel units | 0 | 2 | 2 |
| 5 | Typing, IME handling, step repeat, and slider bounds | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A finite sweep can emit an infinite interior sample

[sweep.ts](packages/ui-input/src/sweep.ts#L101) · Pass 1 · Low · Verified by a read-only Node probe

Walking a four-sample range from 0 to `1e308` yields `Infinity` as its third sample, even though the corresponding scrubber position at `2/3` yields a finite value around `6.67e307`. The walk multiplies the finite span by the sample index before dividing by the number of intervals. A caller passing those samples to a control or renderer receives a value outside the declared finite range.

### 2. Horizontal grid navigation ignores the supplied row order

[grid.ts](packages/ui-input/src/grid.ts#L170) · Pass 2 · Low · Source-traced

The API takes row arrays in reading order. Up and Down use those arrays, but Left, Right, Home, and End scan the numeric index order of `enabled`. For rows `[[2, 0], [1, 3]]` with every item enabled, Right from item 2 moves to item 3 instead of the adjacent item 0, and Home goes to item 0 instead of the first visible item 2.

Source and tests were left untouched.
