---
"@weasel-js/ui": patch
---

`PaintInput`'s solid editor reads a paint's alpha from its `opacity` slot, where every paint kind has carried it since fill and stroke collapsed onto their object forms. The opacity slider used to read only the hex, so it showed 100% for any solid painted translucent through `opacity` — including every value an opacity scrub writes. Edits now commit the canonical `solid()` shape (`{ color: '#rrggbb', opacity }`) instead of `{ fill: 'solid', color: '#rrggbbaa' }`, so the alpha lands in one slot rather than two that multiply.
