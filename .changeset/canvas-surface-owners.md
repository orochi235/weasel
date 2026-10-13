---
'@weasel-js/core': patch
---

Several things `<Canvas>` did inline now have one owner each, shared with the other surfaces that did the same thing by hand. Most of it cannot be seen from outside; what can is listed here.

Adds API: `<CanvasView>` takes `cameraRef`, which receives `getView`, `setView`, and `subscribeView` for that view's camera (`CanvasViewCamera`), with the contract `<SceneCanvas>`'s own handle keeps: `setView` accepts an updater, subscribers hear every camera change, and an imperative `setView` on a controlled view is forwarded to `onViewChange`, not applied, and warns once. A pan or zoom made by input inside a controlled view is forwarded without the warning, as before. A view's camera is now the same implementation as the canvas's.

Changes: a `<CanvasView>` switched from controlled to uncontrolled continues from the last controlled camera, where it used to return to the last camera it held uncontrolled. A view controlled by a plain `view` value no longer repaints on a write it only forwarded; it repaints when the prop changes.

Breaking: `onFocus` and `onBlur` on `<SceneCanvas>` are called with the DOM `FocusEvent`, not React's synthetic one, and are typed `(event: FocusEvent) => void`. A handler typed against `React.FocusEvent` needs its parameter type changed; one that reads `event.target` or takes no argument is unaffected.

Fixes: `onFocus` and `onBlur` did nothing on a canvas given `paintInto`. They now report focus of its `inputElement`. `className`, `style`, and `tabIndex` still apply only to a canvas element the component renders, and their docs now say so.

Changes: the press that focuses the canvas, hover delivery to layers, and context-menu suppression are DOM listeners on the canvas element where they were React handlers, so they run when the event reaches the element instead of when it reaches React's root. A canvas given `paintInto` already worked this way.

Fixes: the debug overlay's frame-rate panel lost its history and showed no rate for a frame whenever a layer or a view was registered or removed.

Fixes: a `<Canvas>` with no `<SceneCanvas>` around it now repaints when an image finishes decoding, a glyph bake lands, or a paint kind registers late, as `<DrawCanvas>` and `<SceneViewCanvas>` already did.

Fixes: a canvas that unmounted left its handle in the view registry around it.

Changes: `decorationLayer` is composed as a `layers` entry keyed `decorationLayer` with no anchor, so another custom layer can anchor `before` or `after` it. It paints where it did, except that it now sits beneath a custom layer whose anchor names nothing or forms a cycle, which already warns. Its docs and `backgroundFill`'s described a draw order the code never had: the background sits beneath everything, the grid included, and the decoration layer sits above every slot and custom layer and beneath a tool's `'top'` overlays.
