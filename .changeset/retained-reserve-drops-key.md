---
"@weasel-js/renderer": patch
---

A retained group's surface no longer matches its old key once `reserve` has handed it out to be drawn over: until `commit` names the key the new pixels were drawn under, a lookup redraws rather than compositing pixels from a draw that never finished.
