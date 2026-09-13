---
"@weasel-js/audio": patch
---

The audio engine's scheduler pass is now woken from a timer inside a dedicated
Worker rather than a main-thread `setTimeout`. A hidden tab clamps main-thread
timers to at least a second, which a 100 ms lookahead cannot cover, so sounds
booked while the tab was away arrived late.

`createTickTimer()` is the new wake source, exported beside `createScheduler` for
anyone driving a scheduler without an engine. It keeps the scheduler's one-shot
`setTimer`/`clearTimer` contract: each delay is booked in the worker, which posts
the timer's id back when it elapses. A `MessageChannel` was not enough on its
own, because it has no delay and could only busy-spin.

The worker is built from an inline `blob:` script, not a separate file, because
`new Worker(new URL(..., import.meta.url))` survives some consumer bundlers and
not others (esbuild leaves the file behind). The cost is CSP: a page whose policy
refuses `blob:` workers gets a fallback to `setTimeout`, as does any environment
without `Worker`, such as SSR or a test runner. Injecting `setTimer`/`clearTimer`
into `createAudioEngine` still replaces the default entirely.
