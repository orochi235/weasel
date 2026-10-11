---
'@weasel-js/forge': patch
---

The workshop does not run a story's `play`, and the frame protocol no longer carries the messages for it: `play` and `played` are gone, with `capture.run` / `capture`, the `size` report, and the `play` fault phase. `TrialFrame` loses `capture` and `size`, and `TrialFrames` loses `reportSize` and `hostRef`; nothing read any of them. This is breaking for code that called those, and an open story no longer keeps a `ResizeObserver` alive. A play still runs under `forgeTest`.
