---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

An inherited value draws in the secondary accent instead of faded, which read as disabled. `@weasel-js/theme/inherited.module.css` holds the one definition, `.inherited`, which remaps the accent tokens to their secondary twins; the prefs form's inherited rows compose it and `ControlMatrix`'s inherited cells mix it in.
