---
'@weasel-js/ui': patch
---

`ToggleBar`, `ActionsBar` and `OptionsBar` segments now take their height from the bar. Inside a labkit page, labkit's default button height used to win instead, so a `size="sm"` bar drew 24px segments in a 17px track and clipped their labels.
