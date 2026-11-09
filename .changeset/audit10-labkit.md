---
'@weasel-js/labkit': patch
'@weasel-js/prefs': patch
'@weasel-js/routing': patch
---

Fixes to labkit's chrome, trial keys and settings rail, and to how action and enum prefs report their state.

- A trial may suppress `eyedropper`, `picked-color` and `snapshot-load` before they appear. Before, naming one in `suppress` threw until a lens mounted or a snapshot was saved, as naming a typo does.
- `sectionTree` answers an action's `activeIf` against the config, as it does `showIf` and `enableIf`. Before, the rail form read the condition against its renested values, where nothing is at the config's paths, so the button never latched.
- A lab header item's command carries the item's icon, shortcut text and danger grade, so a palette or menu running it shows what the header button does.
- A held Mod+S saves one snapshot rather than one per key repeat.
- The palette keeps a group's tools together where the group first appears, as every other region does. Before, it drew them in declaration order, and `TrialTool.group` said ungrouped tools sorted last, which nothing did.
- `applyPrefConditions` names an action in `active` only where its `activeIf` was answered. Before, an action in a list's item whose condition reads the entry was reported active at `rows.*`, and `applyPrefEntryConditions` reported an entry's action active whenever its condition read anything but the entry.
- A menu drawn from an enum pref carries each option's icon, description and disabled reason onto its row, as forms and selects already do; forge's Globals menu shows them.
