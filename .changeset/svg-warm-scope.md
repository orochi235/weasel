---
"@weasel-js/svg": patch
"@weasel-js/text": patch
"@weasel-js/core": patch
---

Add `warmSvg(nodes)` and `svgNeeds(nodes)` to `@weasel-js/svg`. `serializeSvg` is synchronous, and its missing-def warning used to point at `warmPaintKinds()`, which loads every lazily registered kind and fails when any unrelated one does. `svgNeeds` reads the serializer's own paint pre-pass, so it lists exactly the paint kinds the export writes as paint servers — fills and strokes, text and run paints, through nested groups — plus the faces whose font metrics size a sub- or superscript run with its own `baselineShift`. `warmSvg` loads only those. Core now exports `isPaintKindKnown`, and `@weasel-js/text` (re-exported by core) adds `resolveRunFace(run, style)`, the family, weight and style a run is set in, read without touching the font registry. Additive.
