---
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
---

Any lab can have lenses: `<Lab labChrome={[labLoupe]} />` from `@weasel-js/labkit/loupe` mounts the lens canvas
over the lab body and the Loupe keymap (Alt+L, then L adds a lens). Each lens shows a copy of the trial under its
reticle, from the new `createCloneSource`, so SVG and text stay sharp at any factor. The lens API forge's workshop
used — `createLensApi`, `useLensFocus`, `lensClient`, `useLensRemeasure` — moved into labkit, and forge now uses it
from there.
