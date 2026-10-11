---
'@weasel-js/labkit': patch
---

A stage or canvas trial whose opening view is fitted once its size is known (no `initialView`, or a function one) could open below the instrument's `minZoom`, and the first drag then snapped the zoom up to `minZoom` while panning. The same happened after entering presentation refitted the view. The camera now widens its zoom range to reach any view it is handed from outside, not only the one it mounted with; its own zoom gestures still never widen it.
