---
'@weasel-js/core': patch
---

Hit-test affordances against the chrome state that was painted.

The gesture dispatcher's `affordanceAt` built a `ChromeState` of its own —
selection off a ref, bounds straight from the resolver, its own union AABB —
next to the one the canvas helpers had already built. The two differed by the
in-flight overlay: mid-drag, resize handles painted at the ghost while their
hit regions stayed at the committed pose.

A surface now publishes its view chrome on the handle it attaches to the view
registry, and the dispatcher reads it from there. `ChromeState` gains an
`EMPTY_CHROME_STATE` for the before-attach case, and `anchorStateFrom` is the
dep-registry read the mounter used to inline.
