---
'@weasel-js/core': minor
'@weasel-js/editing': minor
---

A shape-following selection outline can hide under the nodes painted in front of the selected one: `outline: { follow: 'shape', mask: true }`.

Each node after the outlined one in paint order covers the outline with the region its ink reaches, filled or not; nodes painted before it, its own children, hidden nodes and layers the view does not paint cover nothing. The mask is rebuilt when the scene's version or override generation moves, so an edit or a drag costs one rebuild per frame: about 3 ms for an outline under 200 overlapping rects and 15 ms under 200 ellipses, measured on an M5 Max. `mask` needs `follow: 'shape'` and a shapes scene that answers `renderOrderNodes()` and `getVersion()`, as a `Scene` and the canvas's own do; the layer throws without them.

```tsx
<SceneCanvas layers={{ selectionOverlay: { outline: { follow: 'shape', width: 2, mask: true } } }} />
```

<!-- entry: rank=5 new api visual -->
