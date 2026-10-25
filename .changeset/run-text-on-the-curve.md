---
'@weasel-js/ui': patch
---

Labels in a control laid along a curved `Along` — `ToggleBar`, `ButtonBar`, `OptionsBar`, `Bar`, `Tabs`, `PageTabs`, `RadioGroup` — now follow the curve: each run of text is drawn on an arc parallel to the track, through its own baseline, instead of straight across its item. The text keeps its place in the DOM for layout, selection and the accessible name.
