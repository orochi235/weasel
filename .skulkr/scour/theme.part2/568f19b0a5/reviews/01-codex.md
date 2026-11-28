# Review saturation for `theme.part2`

Snapshot `568f19b0a5d77f44573db285ca105b338fe55d3f`. The tracked working tree was clean. Scope is the 28 files listed in the [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Color-mode state and preference storage changes | 1 | 1 | 0 |
| 2 | Provider lifecycle, stylesheet reference counts, and resolved selections | 0 | 1 | 1 |
| 3 | Preference scopes, token conversion, and inherited defaults | 0 | 1 | 2 |
| 4 | Theme store replies, token helpers, and style defaults | 0 | 1 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Switching preference stores can keep the previous store's color mode

[useColorMode.ts](packages/theme/src/useColorMode.ts#L59) · Pass 1 · Low · Source-traced

The hook only refreshes its state when `storageKey` changes. A mounted host that switches its `storage` option between two backing stores using the same key keeps the old preference even if the new store holds another one. For example, the UI can keep showing the first profile's light mode after switching to a profile whose store holds dark mode. The setter already follows the new store, so reads and subsequent writes are temporarily bound to different stores.

Source and tests were left untouched.
