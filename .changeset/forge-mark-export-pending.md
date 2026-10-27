---
'@weasel-js/forge': patch
---

A mark export of a story captured before its first paint no longer comes out transparent: the capture's copy of
the story host drops the pending state that hides the host until its fonts have painted.
