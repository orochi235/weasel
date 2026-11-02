---
'@weasel-js/core': patch
'@weasel-js/minimap': patch
'@weasel-js/labkit': patch
---

`usePublishPointer(elementRef, locate)` from `@weasel-js/core` publishes the pointer over an element into
the pointer store in scope, placed by `locate(pointerId, clientX, clientY)`. It is what `<SceneCanvas>`
does for its own canvas: a pointer pressed on the element keeps reporting once a drag leaves it, and a
free pointer leaving clears the store unless another view has published since. The minimap and labkit's
cameras now publish through it, so a drag that runs off a minimap or a lab stage no longer stops
reporting where the pointer is.
