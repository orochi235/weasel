---
"@weasel-js/theme": patch
---

`bake` leaves out a selection where a token named `constructor`, `toString`, or another `Object.prototype` member is not produced. It used to bake `Object.prototype`'s function there as the token's value, which JSON then dropped and the runtime read as a token.
