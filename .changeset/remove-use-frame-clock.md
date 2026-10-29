---
'@weasel-js/react': patch
'@weasel-js/core': patch
---

Removes public API: `useFrameClock` and its `FrameClock` and `FrameClockOptions` types are gone from `@weasel-js/react`, and from their re-export in `@weasel-js/core`. Use a `@weasel-js/clock` clock in their place: `createClock({ rate: 1 })` for a clock that runs, `createClockRegistry` and `useClockLoop` from `@weasel-js/clock/react` to drive it, `handle.onFrame` as a render layer's `subscribe`, and `handle.clock.elapsed / 1000` for seconds. Rate 0 pauses it. The loop leaves out time with the tab hidden, as `useFrameClock` did, and skips a clock registered with a target while that element is out of the viewport; unlike `useFrameClock`, a running clock is synced whether or not anything subscribes to its frames.
