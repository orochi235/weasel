---
"@weasel-js/forge": patch
---

The CSS Vars panel saves an edit to a token the theme derives as a pin over that token alone. A derived token is one that follows another token, a ramp, a contrast rule or an alpha. The pin holds only the axis values the trial reads that its value varies on; the derivation keeps giving every other token, and this one everywhere else. A scale step edited by hand after its scale saves the same way, on top of the scale edit, which now saves too.

<!-- entry: new -->
