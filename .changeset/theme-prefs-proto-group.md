---
"@weasel-js/theme": patch
---

`themePrefsSchema` builds for a theme with a token named `toString`, `constructor`, or another `Object.prototype` member, or one whose first word is such a name. `tokenGroupOf` used to read the group through the prototype and the schema then threw a `TypeError`.
