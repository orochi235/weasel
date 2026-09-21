---
'@weasel-js/theme': patch
---

File danger, warning and success under one `status` group.

Each stood alone with two tokens — its base and its semantic — and a token
panel draws a color group as one row of swatches only from three colors up, so
the six status colors took six rows between the ramps. The manifest emitter now
maps those three prefixes onto one group name; nothing else reads the old ones.
