---
'@weasel-js/hud': minor
---

The loupe carries its own controls: a Vector | Pixel switch across its top and a zoom along its bottom rim.

The zoom stops at `zoomStops` (default `LOUPE_FACTOR_STOPS`, 1× to 64× in doublings); a press or drag on its band sets the factor. `controls: false` leaves both off. When either control changes the lens, `onModeChange` and `onFactorChange` report it, so the app can write the change back to wherever it keeps them; `useLoupe`'s events take the same two.

<!-- entry: rank=10 new api visual -->
