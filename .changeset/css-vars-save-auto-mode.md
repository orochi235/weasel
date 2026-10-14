---
'@weasel-js/forge': patch
---

The CSS Vars panel saves a token that differs by mode while the trial's mode is Auto. The save writes the branch for the OS color scheme, the one the story is showing; it used to offer no save for such a token until the mode was set to Light or Dark.
