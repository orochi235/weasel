---
'@weasel-js/forge': patch
---

Check every story's accessibility again. axe runs inside the story's own frame, over the story's subtree rather than the whole frame document, and answers the workshop over the frame's message channel; the workshop shows what it found per story in an Accessibility aside, and holds the last answer against the trial.

New: the `a11y.run` / `a11y` protocol pair, `A11yReport` / `A11yFinding` / `A11yNode` from `@weasel-js/forge`, and `useTrialFrame`, `TrialFrame.audit`, `TrialFrame.a11y` and `A11yPanel` from `@weasel-js/forge/shell`. An audit is held until the frame says it has rendered, so it never judges an empty story. `axe-core` is a new dependency of the package and loads only when a frame is first audited.

`TrialFrames.connect` now takes `{ send, audit }` in place of a bare `send`.
