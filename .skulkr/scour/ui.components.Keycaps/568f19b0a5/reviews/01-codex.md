# Review saturation for `ui.components.Keycaps`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. Scope is the 28 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Held-key state, event targets, and focus transitions | 1 | 1 | 0 |
| 2 | Keyboard layouts, placement, and per-key overrides | 0 | 1 | 1 |
| 3 | Key legend measurement and spelling selection | 0 | 1 | 2 |
| 4 | Chord formatting, modifier deduplication, and sequence rendering | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Tracking a key target in another window uses the wrong focus lifecycle

[useHeldKeys.ts](packages/ui/src/components/Keycaps/useHeldKeys.ts#L40) · Pass 1 · Low · Source-traced

With an explicit target from a same-origin iframe or popout, keyboard events attach to that target, but window blur attaches to the hook's ambient window. If the target is the popout window itself, losing focus there can leave a key lit because its keyup is delivered elsewhere and the hook never hears that window's blur. For an element target from the other window, the ambient `Node` checks can also clear held keys during focus movement between descendants of that same target.

Source and tests were left untouched.
