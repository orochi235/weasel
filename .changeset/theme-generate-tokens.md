---
'@weasel-js/theme': patch
---

`@weasel-js/theme/engine` exports `generateTokens(definitions)`, which returns `tokens.css`, `themes.ts` and `manifest.ts` for a set of theme definitions, or the derive problems that stop them; the package's `gen:tokens` script now calls it. The engine also exports `declaredSteps(entry)`, every step a ramp or scale entry can declare, and the runtime entry exports `isByAxis`.
