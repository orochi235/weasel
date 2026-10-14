---
'@weasel-js/labkit': patch
---

A trial's view that nobody has moved is placed again when its viewport changes size. With an `initialView` that depends on the viewport, which a `stage` has by default (`fitStage`), adding a trial used to narrow the first trial's stage and leave its content past the edge, at the pan it opened with. A view that has been panned or zoomed keeps its pan through a resize, as before. This changes behavior for a canvas instrument whose `initialView` is a function too: it is called again on a resize while the view still sits where it last put it.
