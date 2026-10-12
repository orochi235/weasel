---
'@weasel-js/core': patch
---

Fixes: `useHostAnchor` did not follow a host that moved without resizing. It recomputed on scroll, on window resize, and on a size change of the host or the panel, so a sibling collapsing beside the host shifted it with none of those firing, and the dev HUDs stayed where the host had been. It now also watches the host's box for a move, with an `IntersectionObserver` framed around it.
