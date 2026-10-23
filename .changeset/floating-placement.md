---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`@weasel-js/ui` exports `useFloatingPlacement`, from the root and from a new `@weasel-js/ui/floating` subpath: it
places a box over its container through windease's floating strategy and lets a drag move it, snapping to the
container's corners. It is controlled — it takes `placement` and reports a drag once, on release, through
`onPlacementChange` — and persists nothing. A drag captures the pointer only past the drag threshold, and Escape puts
the box back. `@weasel-js/ui` now depends on `windease`.

labkit's `FloatingPanel` is built on the hook, and still remembers its position through its `persist` prop. Its
placement now reaches persistence once per drag, on release, rather than on every move, and Escape cancels a drag.
