---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

Collapse four duplicated helpers and drop three dead modules.

`Badge`'s shape-control table lived twice — once in `shapeControls.ts`, which nothing imported, and once re-declared inside the stories, which is the copy that rendered. The stories now import the module, so the badge shape defaults have one definition again. `Badge`, `Shield` and `Perforated` shared eleven identical lines of ResizeObserver measurement for the same viewBox-unit conversion; that is now `useSvgBox`.

`composeSelectionPose` and `makeContainerAwareBoundsResolver` each carried their own copy of the leaf walk, including the rule that keeps an empty container from contributing bounds — one function now, so the rule can be fixed in one place.
