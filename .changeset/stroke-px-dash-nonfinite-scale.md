---
"@weasel-js/stroke": patch
"@weasel-js/renderer": patch
---

A `{ px }` stroke's dashes and dash offset resolve at a scale the way its width does. Under an infinite scale `strokeAtScale` (and so `strokeToPath`) and the renderer's stroke resolution left the width as given but multiplied every dash by zero, which drew the stroke solid; the dashes are now left as given too.
