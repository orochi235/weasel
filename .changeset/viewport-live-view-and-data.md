---
'@weasel-js/core': patch
---

A viewport node can host a live camera and its own per-view data.

`view` now accepts a thunk as well as a `View`. It is read fresh on every
`draw`, `reproject` and `resolvable`, so those three cannot disagree about where
the viewport is looking part-way through a gesture. The thunk receives the outer
view and dims, so a derived camera — parallax, node-anchored scroll — is a
function of the one hosting it.

A `data` thunk derives what the source layers receive from what the outer canvas
passed down. Without it they get the outer canvas's `data`, as before. This is
what lets a viewport showing the same scene through a second camera give its
layers their own selection, chrome state and gesture previews instead of the
hosting view's.

Both are additive: `CreateViewportLayerOpts` gained a second type parameter that
defaults to the first, so existing call sites infer exactly as they did.
