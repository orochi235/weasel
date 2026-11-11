---
"@weasel-js/forge": patch
---

Saving a CSS variable edit reads only tokens and branches a theme holds as its own. An edit to a token named like an `Object.prototype` member that the theme does not define was saved as a new pin rather than refused, and one the theme writes out under such a name was pinned over instead of written in place.
