---
'@weasel-js/theme': patch
---

`resolveStanceSlots` gives a stance that declares no tint of its own the stance's surface, as the generated CSS does, rather than the base surface. A HUD window with `stance: 'aside'` no longer mixes the raised surface into its border bands where the DOM panel is transparent.
