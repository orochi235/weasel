---
'@weasel-js/audio': minor
---

A voice stopped before its `when` leaves the scheduler's queue at once, rather than staying booked until its time, and `Scheduler.schedule` returns a cancel for the one event it booked.

<!-- entry: fix api -->
