---
'@weasel-js/labkit': patch
---

A `<TrialSceneCanvas>` whose trial picks a tool as it mounts no longer locks the page up with "Maximum update depth exceeded". The canvas reported the tool it had before the pick, the tool slot took that as a change made on the canvas and wrote it back, and the two traded values for good — reliably under `StrictMode`. The slot now waits for the canvas to report a tool it was told to take before it reads the canvas's tool as a choice of its own. A trial's tool write of the tool it already holds no longer notifies the store's subscribers either.
