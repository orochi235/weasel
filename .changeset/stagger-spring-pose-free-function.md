---
'@weasel-js/core': patch
---

`animator.stagger(items, delay).springPose(adapter, poseFn, opts)` is gone, and `staggerSpringPose(animator, adapter, { items, delay, to, ...opts })` replaces it, beside `springPose` and `tweenPose`. Breaking: a caller of the builder method moves to the function, and `poseFn` becomes the `to` option. The stagger builder keeps `.each` and `.tween`. This takes the animator's last reference to a scene adapter out of it.
