---
'@weasel-js/labkit': patch
---

In a lab with no compare menu, the Loupe keymap shows "Compare with…" disabled instead of offering a key that does nothing.

`LensActionApi.openCompareMenu` is now optional, and `createLensApi` leaves it out when given no `compare` ref; code calling it directly writes `api.openCompareMenu?.(lensId)`.

<!-- entry: fix -->
