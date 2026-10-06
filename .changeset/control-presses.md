---
'@weasel-js/gestures': patch
'@weasel-js/routing': patch
'@weasel-js/core': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

The gesture dispatcher no longer takes a press that lands on a control inside its host — a button, field, link or anything with a control role. It used to open a pointer session that captured the pointer, so the browser delivered the click to the host instead, and a button laid over a canvas (labkit's instrument overlay, for one) could not be clicked with a real pointer. `isInControlWithin` and `CONTROL_SELECTOR`, which answer that question, move from weasel-ui's internals to `@weasel-js/gestures`, re-exported by routing and core.
