---
'@weasel-js/react': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A camera animation that names no duration of its own now takes 0ms while the reader's `prefers-reduced-motion` is `reduce`, in place of the `view.animationMs` kit setting or its default, and follows the preference as it changes. `@weasel-js/react` exports `prefersReducedMotion()` and a `usePrefersReducedMotion()` hook that re-renders when the preference changes; the long-press ring and `@weasel-js/ui`'s components now read the preference through it.
