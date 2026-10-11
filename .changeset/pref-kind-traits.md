---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`@weasel-js/prefs` exports `PREF_KIND_TRAITS`, one record saying of every built-in kind whether its value is made of other leaves and whether its control is several controls, with `prefIsCompound` and `prefDrawsSeveral` to read it. `PrefsForm`, the bar, and labkit's `ControlPanel` read it in place of their own lists of kind names, so a kind added to `PrefKind` does not compile until it says what it is. labkit's `ControlPanel` now draws `font-family` and `font-weight` leaves with the pickers ui has for them; it said it had no control for them.
