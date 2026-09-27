---
"@weasel-js/core": patch
---

`<Canvas>`'s debug HUDs (cursor coordinates, pick list, modality) share one stylesheet instead of carrying three copies of the same box. The cursor-coordinates HUD no longer styles itself inline. Nothing renders differently.
