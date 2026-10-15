---
'@weasel-js/core': patch
---

On a controlled `<SceneCanvas>`, writing `view` in your own state now stops a camera glide in flight, the way `setView` and input already did; before, the glide's next frame overwrote the write. The canvas tells the write from your handling of the glide's own frames by order, not by value: a `view` prop that moves when the glide has written no frame since the prop last moved is yours. So a consumer who clamps or rounds inside `onViewChange` still gets a whole glide, and one who moves the prop a second time for one frame (from an effect, or a deferred value) stops it. A write that lands in the same render as a frame's is not seen, and the glide carries on. Behavior change.
