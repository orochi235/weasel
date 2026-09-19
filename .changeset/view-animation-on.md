---
"@weasel-js/core": patch
---

Add `useViewAnimationOn(view, animator)`: `useViewAnimation` on an animator the
caller owns, without the idle fallback animator `useViewAnimation` has to build
because a hook cannot be called conditionally. `<SceneCanvas>` now uses it, so
each canvas constructs one camera animator instead of two. Additive;
`useViewAnimation` is unchanged.
