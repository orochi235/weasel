---
'@weasel-js/forge': patch
---

Browser Back and Forward now move a trial between the stories it showed.

Opening a story from the tree swaps it into the focused trial, but Back then
found no trial of the previous story and opened a new one beside it. A history
step across such a swap now swaps the trial back. A hash typed or linked to
still opens a trial of its own.
