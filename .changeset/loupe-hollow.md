---
'@weasel-js/labkit': patch
---

`<TrialLoupe hollow>` draws only the lens's ring, shadow and shape and leaves its inside clear, for a host that draws the magnified view itself; no painter runs, and a `source` still answers `onColorChange`. `onLens` reports where the lens is drawn and what it shows — `center`, `shows`, `width`, `height`, `factor`, `shape`, in host CSS px — whenever that changes, and `null` when a lens that was up goes away. `LoupeLens` is now exported from `types`; `@weasel-js/labkit/loupe` exports it as before.
