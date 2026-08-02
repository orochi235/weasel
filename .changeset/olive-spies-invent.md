---
"@weasel-js/core": patch
---

`VERSION` reports the right number again. `@weasel-js/core@0.7.1` was published
from a working tree whose `dist/` predated the version bump, so the constant
baked into that tarball reads `0.7.0` while the package it ships in is `0.7.1` —
the one export whose entire job is to say what you are running, saying the wrong
thing. Nothing else in 0.7.1 is affected: the value is stamped at build time by
`tsup`'s `define`, so only a stale build can desync it, and only `core` bakes it.

npm tarballs are immutable, so 0.7.1 cannot be corrected in place. Anything
pinned there should move to this release; `0.7.1` is deprecated on npm pointing
here.
