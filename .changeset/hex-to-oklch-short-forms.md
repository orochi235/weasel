---
'@weasel-js/paint': patch
---

`hexToOklchDeg` read any hex that was not exactly `#rrggbb` as a different color: `#fff` came back as blue, and `#ff000080` with its channels shifted by a byte. It now reads `#rgb`, `#rgba`, and `#rrggbbaa` as the colors they name, ignoring alpha.
