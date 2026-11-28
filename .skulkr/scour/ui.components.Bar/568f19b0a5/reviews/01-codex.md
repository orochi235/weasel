# Review saturation for `ui.components.Bar`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 41 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Overflow sizing, reference frames, and cached widths | 1 | 1 | 0 |
| 2 | Keyboard reordering, focus restoration, and shortcut metadata | 1 | 2 | 0 |
| 3 | Pointer reordering, wrapped lines, and hidden siblings | 0 | 2 | 1 |
| 4 | Menus, popovers, and dock measurements | 0 | 2 | 2 |
| 5 | Bar composition, field rendering, and turned layouts | 0 | 2 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A scaled ancestor can send fitting controls into overflow

[useBarOverflow.ts](packages/ui/src/components/Bar/useBarOverflow.ts#L58) · Pass 1 · Low · Source-traced

The hook compares transformed bounding widths for children with the untransformed client width and computed gap of the bar. For a bar under an ancestor scaled to twice its layout size, two unscaled 40px controls fit in a 100px row, yet the fit calculation sees 160px of controls before gaps. The overflow menu can appear even though the controls fit. A shrinking transform can cause the opposite error.

### 2. Reorder shortcut announcements can erase a control's own shortcut metadata

[useBarReorderKeys.ts](packages/ui/src/components/Bar/useBarReorderKeys.ts#L79) · Pass 2 · Low · Source-traced

When reordering is enabled, the hook replaces a marked control's entire `aria-keyshortcuts` attribute with the reorder arrows. If reordering is subsequently disabled while that same control stays mounted, the hook removes the attribute outright. A shortcut already declared by the control stops being announced, even if its action remains available.

Source and tests were left untouched.
