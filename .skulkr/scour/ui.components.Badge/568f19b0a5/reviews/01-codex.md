# Review saturation for `ui.components.Badge`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 23 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Split badge roles, keyboard activation, and tooltip routing | 1 | 1 | 0 |
| 2 | Logical padding, physical insets, and cascade precedence | 1 | 2 | 0 |
| 3 | SVG and content measurement across resize and animation | 0 | 2 | 1 |
| 4 | Base selection, outline composition, and focus-ring geometry | 0 | 2 | 2 |
| 5 | Catalog fallbacks, variant defaults, and Powerline integration | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A removable badge can activate on a Space release it never received the press for

[BadgeLabel.tsx](packages/ui/src/components/Badge/BadgeLabel.tsx#L74) · Pass 1 · Low · Source-traced

The split label's button emulation runs the action on any Space keyup targeted at the label. It never records a matching keydown. If focus moves to the label while Space is held, releasing the key can run the badge action even though the gesture began elsewhere.

### 2. Lifting logical padding sends it to the wrong sides in vertical writing modes

[paddingSides.ts](packages/ui/src/components/Badge/paddingSides.ts#L63) · Pass 2 · Low · Source-traced

The badge accepts a standard React `style` object. In `vertical-rl`, `paddingBlock` belongs on the right and left, and single-value `paddingInline` belongs on the top and bottom. The conversion always writes block values to top and bottom and inline values to left and right. A badge in vertical text can therefore show spacing on the wrong axis and size its label's hit area using those values.

Source and tests were left untouched.
