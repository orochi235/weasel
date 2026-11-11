---
"@weasel-js/forge": patch
---

Saving a CSS variable edit reads only the tokens and branches a theme holds as its own. An edit to an undefined token named like an `Object.prototype` member is refused, and one the theme writes under such a name is written in place.

<!-- entry: rank=-5 fix -->
