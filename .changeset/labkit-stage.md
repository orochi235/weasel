---
'@weasel-js/labkit': patch
---

Add a `stage` capability: an instrument whose picture is DOM declares its content size, and the trial pans and zooms it through the trial's camera the way it does a canvas — wheel, drag, and the zoom controls, which now appear for either capability. The content opens centered and shrunk to fit unless `initialView` says otherwise; `fitStage` and `<Stage>` are exported for hosts building their own.
