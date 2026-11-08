---
'@weasel-js/react': patch
'@weasel-js/headless': patch
'@weasel-js/parallax': patch
---

Fix visibility gating, a leaked browser context and screen-space tiling.

- `useVisibleRaf` reads the newest of the reports an `IntersectionObserver` delivers together for its target, so an element that entered and left the viewport between two callbacks no longer reads as visible, and a report still queued for a replaced target no longer gates the new one.
- `useVisibleRaf` runs a request it held while suspended as soon as `dangerouslyRunWhenHidden` is set, instead of waiting for the document to show again.
- A node raster host given a `browser` closes the context it opened there when the page script fails to start.
- `createTiledLayer` draws its `space: 'screen'` sources in screen space, rather than scaled by the zoom and moved by the pan.
