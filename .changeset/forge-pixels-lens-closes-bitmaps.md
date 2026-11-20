---
'@weasel-js/forge': patch
---

The loupe's Pixels lens frees each captured image it no longer shows, rather than holding its memory until reload.

It closes a capture once it is replaced, evicted past the loose-shot bound, made stale by a story edit, or left by the last lens showing it.

<!-- entry: fix -->
