---
'@weasel-js/react': patch
'@weasel-js/core': patch
---

Adds API: `useFrameClock(options?)` in `@weasel-js/react`, re-exported from `@weasel-js/core`. It returns a stable `{ seconds(), subscribe }` driven by `useVisibleRaf`: each frame notifies the subscribers and sets no React state, so a shader uniform or a procedural layer animates without its owner re-rendering. It has `subscribe`, so a `RenderLayer` names it as its redraw source (`subscribe: clock.subscribe`) and reads `clock.seconds()` in `draw`. The clock runs only while it has a subscriber, and leaves out time spent hidden or `paused`; `start` sets what it reads before the first frame. Added on an agent's judgment, to take the hand-written elapsed-time loop out of the custom shader demo.
