---
"@weasel-js/theme": patch
---

A token named `__proto__` is now refused as an unsafe name and reported as an `invalid` issue, as other names a token cannot carry are. `derive` used to drop it without a word, so a reference to it failed as dangling and a save from forge's CSS variable panel had nowhere to put it.
