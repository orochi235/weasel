---
"@weasel-js/core": patch
---

`usePoseRun` and `useSimulation` hand their injected clock straight to
`useVisibleRaf` instead of defaulting it themselves. The gate already falls
back to `requestAnimationFrame`, so both were defaulting it twice — and the
copy in `usePoseRun` was a bare `requestAnimationFrame` in kit source, which
`check:frame-loops` fails the build on. The allowlist is back down to the gate
itself.
