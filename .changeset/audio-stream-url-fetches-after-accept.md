---
'@weasel-js/audio': patch
---

`stream(url)` loads its media only once the play is accepted, so a play that throws or is dropped downloads nothing.

<!-- entry: fix -->
