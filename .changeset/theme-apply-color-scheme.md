---
'@weasel-js/theme': patch
---

`applyTheme` writes `color-scheme` for the selected axis value, as the built stylesheet already did. Before, a runtime theme whose own mode value carried a `scheme` (say a `sepia` mode marked `light`) left native controls in whatever scheme the page around it had.
