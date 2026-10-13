---
'@weasel-js/ui': patch
---

`PrefConditionEditor` types a number in its pref's display unit. A row comparing a number pref that has a `unit` shows the value in that unit with its suffix, reads typed text in any unit the pref accepts, and writes the stored number, which is what a condition compares. The value is now drawn by the number control `PrefsForm` draws for the pref, so it is a spin button where it was a plain text box, and it stays within the pref's `min` and `max`.
