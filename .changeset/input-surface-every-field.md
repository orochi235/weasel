---
"@weasel-js/ui": patch
"@weasel-js/theme": patch
---

ComboBox, MenuButton's trigger and ListEditor's input now read `--wzl-input-surface`, as Input, NumberField and Select already did. Inside a Prefs pane, which sets it, they now match the fields beside them instead of sitting on the default sunken surface.
