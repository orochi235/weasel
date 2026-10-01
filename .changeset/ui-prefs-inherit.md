---
'@weasel-js/ui': patch
---

`PrefsForm` and `PrefsDialog` can show leaves that inherit a value from elsewhere. Pass `auto` (the paths that inherit) and the form draws those rows with their control dimmed, showing the value you passed; `inheritHint` adds text after the label such as "from Defaults". Editing an inherited control calls `onChange` as usual. With `onAutoChange`, a leaf's label toggles between inheriting and pinned; `canInherit` says which leaves get that toggle. A custom renderer now receives the real `auto` state and a working `setAuto`.

`PropertyRow` gains `autoControl="dimmed"` (keep drawing an auto row's control, faded, instead of hiding it) and `hint` (small muted text after the label). The ⓘ help button is exported as `PropertyHelp`.

An inline property row that runs past one line — beside a textarea or list editor, or with a label that wraps — now lines the label's first line up with the control's first line instead of centering the label on the whole control, including under `align="center"`. One-line rows are unchanged.
