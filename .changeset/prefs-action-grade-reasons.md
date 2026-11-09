---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Grade, shortcut and pressed state for an action pref, and why a pref is disabled

- An `action` leaf takes `grade` (`'danger'` draws a "Clear all" red), `shortcut`, the keys shown in its tooltip and a menu's row, and `activeIf`, a condition that draws its button pressed while it holds. All three are plain data, so they survive JSON. On a leaf naming a registered `action`, `shortcut` and `activeIf` are drawn over the action's own; on a leaf with only `run`, they are all it has. `PrefGrade` is exported, the same values as theme's `Grade`.
- `applyPrefConditions` and `applyPrefEntryConditions` return `active`, the paths of the actions whose `activeIf` holds, and `checkPrefConditions` checks `activeIf` as it checks `showIf` and `enableIf`. `PREF_CONDITION_FIELDS` names all three, and `PrefConditionField` includes `activeIf`.
- Every leaf takes `disabledReason`, read in its tooltip while it is disabled. An enum option, now exported as `PrefEnumOption`, takes `description`, its tooltip, and `disabledReason`.
- `PrefsForm`, `Bar`, `SelectionPanel` and labkit's `ControlPanel` draw all of these. A row's help reads the reason after the description, an action's button and a segment keep a tooltip saying it, and a selection panel latches an action only while its `activeIf` holds for every node selected. `useLeafAction` takes the latch as a fourth argument and returns `grade`.
- `PropertyRow` and `PropertyHelp` take `disabledReason`, as does every field (`PropertyField`, `PropertyControl`); a `PropertyOption` takes `description` and `disabledReason`, which a toggle's segments draw and a select, radio group or menu does not yet. `BarActionButton` takes `grade`.
- The schema editor offers Why disabled on every leaf with a control, Grade, Shortcut and Pressed if on an action, and Description, Disabled and Why disabled on each enum option.
