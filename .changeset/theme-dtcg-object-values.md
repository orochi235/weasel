---
'@weasel-js/theme': patch
---

`loadDTCG` reads the object forms the DTCG format gives a dimension or duration (`{ "value": 8, "unit": "px" }`) and a color (`{ "colorSpace": "oklch", "components": [0.7, 0.1, 250] }`). A color is written in CSS's own notation for its space, hex for an in-gamut sRGB color, with nothing converted or clamped. Before, each of these resolved to the text `[object Object]`. A value no custom property can hold, such as a composite shadow or typography token, now throws naming the token.
