---
'@weasel-js/theme': patch
---

`generateTokens` reported success for a definition with an axis that has no values, writing an empty `:root` and a `themes.ts` that does not parse. An axis whose `default` is not one of its `values` failed with `Token "..." references "...", which is not defined`, naming neither the axis nor the default. `derive` now reports both as an `invalid` issue at `axes.<name>`, and `generateTokens` refuses the set with that issue.
