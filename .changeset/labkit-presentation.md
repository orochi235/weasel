---
'@weasel-js/labkit': patch
'@weasel-js/core': patch
'@weasel-js/forge': patch
---

labkit: a lab can present one trial and nothing else — no lab chrome, no trial chrome, a transparent ground — for embedding it as a figure. `<Lab present>` or `?present` in the URL starts it that way, opened on `seed={{ instrument, config, state, view }}`; a stored lab then keeps its own records under `storageKey` + `':present'`, and a changed seed reopens the trial for returning visitors. `usePresentation()` gives `{ active, enter, exit }` inside any lab: `enter` presents the focused trial, Escape returns, and nothing remounts either way. While presenting, the page's root `color-scheme` is reset so an iframe embed stays transparent.

core: `stableStringify`, JSON with object keys sorted, moves here from forge, which re-exports it.
