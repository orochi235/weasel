---
"@weasel-js/routing": patch
---

`browserReservedChord` reads Ctrl and Meta beside `mod` as the matcher does: `mod` and the key it stands for are one key, and the other of the two has to be releasable, so `{ mod, ctrl }+Q` on a Mac and Ctrl+Q on a Mac are no longer reported as Cmd+Q.
