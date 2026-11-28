# Review saturation for `ui.components.MotifFrame`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 26 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Default providers, named lookups, and subtree identity | 1 | 1 | 0 |
| 2 | Disabled body behavior and enabled title actions | 1 | 2 | 0 |
| 3 | Heading semantics, names, and landmark roles | 0 | 2 | 1 |
| 4 | Motif slot placement and decorative CSS | 0 | 2 | 2 |
| 5 | Theme appearance inheritance, notes, and context menus | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Adding or removing the named motif map remounts frame contents

[MotifFrame.tsx](packages/ui/src/components/MotifFrame/MotifFrame.tsx#L46) · Pass 1 · Medium · Source-traced

`DefaultMotif` adds or removes an outer provider when `named` changes between omitted and supplied. The change alters the React element type at that position, remounting everything below, including controls whose motif did not change. Adding an unused named motif can reset a form's local state or drop its focus.

### 2. A disabled frame leaves its body interactive

[MotifFrame.tsx](packages/ui/src/components/MotifFrame/MotifFrame.tsx#L101) · Pass 2 · Low · Source-traced

The public `disabled` prop says that the frame contents take no input while the title-row controls remain available. The implementation marks the root, dims the title, and passes the body through unchanged. A button placed in the body continues to accept clicks and keyboard activation unless its consumer separately disables it.

Source and tests were left untouched.
