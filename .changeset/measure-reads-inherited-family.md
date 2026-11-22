---
'@weasel-js/ui-logic': minor
'@weasel-js/ui': patch
---

A button, menu panel or row list measures its text in the font it is actually set in, so a measured box matches the drawn one in any font.

`MeasureEnv` takes an optional `family()`, the font family the target sets its text in; `createDomMeasureEnv` answers it with the element's computed `font-family`. A target without one, such as a HUD, still measures in `--wzl-font-ui`. `envFamily(env)` reads it.

<!-- entry: fix api -->
