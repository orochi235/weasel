---
'@weasel-js/hud': minor
---

A HUD loupe follows the pointer through the HUD's own canvas entry, which now carries `loupe.aim` and `loupe.leave`.

`createLoupe` adds no pointer listeners of its own; the entry from `createHudContribution` / `useHudContribution` drives every loupe on the HUD attached to its canvas. A canvas that attaches a HUD without installing that entry gets a loupe that no longer follows the pointer.

<!-- entry: api behavior -->
