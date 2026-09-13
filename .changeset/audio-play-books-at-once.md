---
"@weasel-js/audio": patch
---

`engine.play()` no longer waits for the scheduler's next pass when the voice's
`when` is already inside the lookahead window. The voice is booked at the end of
the task that called `play()`, so `when: engine.now()`, or no `when` at all,
starts on time instead of up to one pass interval (25 ms by default) late.

Everything played in the same task is booked together, in `when` order, the way
a pass books it, so which voice a full bus steals does not change. A voice
stopped in that same task never starts. `createScheduler` does the same for any
event scheduled inside its window while it is running.

A `play()` made after the context resumes from a suspension, with a `when`
already in the past, now plays at once. It used to be dropped as though it had
come due while the context was suspended.
