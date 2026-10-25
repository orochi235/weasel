---
'@weasel-js/forge': patch
---

A lens over a scrolled isolated story shows the patch under its reticle. The story's frame reports where its document stands with a new `scroll` message, and the shell scrolls each Live copy's frame to match (a `scroll` message to the frame) and sends that position with a Pixels capture, which used to be taken at the top.
