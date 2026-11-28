# Review saturation for `ui.components.MenuBar`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the ten files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Focus capture and restoration across documents | 1 | 1 | 0 |
| 2 | Access chords, dispatch eligibility, and duplicate letters | 0 | 1 | 1 |
| 3 | Title activation, pointer transitions, and disabled states | 0 | 1 | 2 |
| 4 | Conditional schemas, menu switching, and portal wiring | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. A menu bar rendered into a popout can lose its focus-return target

[useMenuBarFocus.ts](packages/ui/src/components/MenuBar/useMenuBarFocus.ts#L57) · Pass 1 · Low · Source-traced

When a menu bar is rendered into a same-origin popout from the parent window, the focus handler checks the popout's previous element against the parent's `Element` and `HTMLElement` constructors. The check rejects a valid previous element from the popout, and the opening logic also reads the parent's active element. Leaving the menu bar can therefore blur the title without restoring focus to the popout control that previously held it.

Source and tests were left untouched.
