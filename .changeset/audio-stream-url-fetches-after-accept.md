---
'@weasel-js/audio': patch
---

`stream(url)` makes and starts loading its media element only once the play is accepted, so a play that throws or is dropped downloads nothing.

<!-- entry: fix -->
