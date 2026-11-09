---
"@weasel-js/routing": patch
---

The route-conflict check reads a `ctrl` or `meta` spelled out beside `mod` as the matcher does, so `mod+ctrl` and `meta+ctrl` are reported as one chord on a Mac instead of passing unflagged.
