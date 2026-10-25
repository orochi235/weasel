---
'@weasel-js/forge': patch
---

A Live lens tells its readouts about a change to the story under it once per visible frame, rather than once per DOM
mutation, so an animating story no longer keeps Token and Contrast recomputing styles on every mutation.
