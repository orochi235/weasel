---
"@weasel-js/forge": patch
---

A Live lens comparing nothing now updates its Token and Contrast readouts when the story under it changes. Those readouts read the main story, but the source only told them of changes to the lens's own copy, so a hover, a focus, or a menu opened in the story left them on their old reading until the lens next rendered.
