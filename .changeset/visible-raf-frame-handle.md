---
'@weasel-js/react': patch
---

`useVisibleRaf` passes the loop's own handle to the frame callback as a second argument, so a continuous loop re-requests through it: `useVisibleRaf((time, loop) => { …; loop.request(); })`. Reaching for the returned handle from inside its own callback still works. The change is additive.
