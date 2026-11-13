---
'@weasel-js/guides': minor
---

Every guides snap source takes an `id`, so two of a kind can snap on one canvas.

`alignmentSnapSource` and `spacingSnapSource` take one now, and a `createSpacingHintsPreset` given an `id` names its sources after it. A preset with `id: 'hints'` asks sources `hints.spacing` and `hints.alignment`; without one they keep `spacing` and `alignment`.

<!-- entry: api -->
