---
'@weasel-js/svg': patch
---

SVG import fixes:

- A declaration CSS rejects (`style="fill: bogus"`, an invalid presentation attribute) no longer wins the cascade and paints black; the declaration below it, or inheritance, stands. `unset` and `initial` are read.
- `url('#id')` and `url("#id")` references resolve in paints and markers, a paint's `none` fallback is taken, and `none` is read in any case.
- A `<clipPath>`'s own `transform` is applied, and `clip-rule` is read and written back.
- `<a>` is read as a group, and `<switch>` draws its first child whose `requiredExtensions` and `systemLanguage` hold and that the parser can draw.
- `<use>` draws the element it references, `<symbol>` included; a reference cycle is reported and drawn as nothing.
