---
"@weasel-js/core": patch
"@weasel-js/geom": patch
"@weasel-js/gestures": patch
"@weasel-js/history": patch
"@weasel-js/modes": patch
"@weasel-js/theme": patch
"@weasel-js/font": patch
"@weasel-js/svg": patch
"@weasel-js/d3": patch
"@weasel-js/hud": patch
"@weasel-js/labkit": patch
---

Document every public export at its definition site

A JSDoc string now sits on each symbol reachable through a package's published
entry points, in every package except `@weasel-js/ui`. Documentation only — no
export was added, removed, renamed or reordered, and no behavior changed.

`npm run audit:jsdoc` enumerates the public exports and reports which lack a
docstring, so the claim can be re-derived rather than trusted.
