---
"@weasel-js/diagram": patch
---

A live audio chart keeps its previews drawn while `useLiveAudioRunner` replaces its runner.

A disposed `LiveAudioRunner` leaves its last run's previews open until `drawn` reports a render without them.

<!-- entry: fix behavior -->
