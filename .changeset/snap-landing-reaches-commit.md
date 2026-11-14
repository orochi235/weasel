---
'@weasel-js/core': minor
---

A snap session can report the subject's exact landing in its host's own terms, and the move and insert actions carry it to the commit.

`SnapOutcome.landing` is opaque to core. A move hands it to `PoseDescriptor.translate` as a new fifth argument, `landing`, for the drag it was reported with; an insert puts it on `InsertEnds.landings.start` or `.end` for the end it placed. Either is dropped once a behavior moves the point. `SpanSnap.landingAt(p)` answers it for an end at `p`.

<!-- entry: rank=3 api -->
