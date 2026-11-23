---
"@weasel-js/diagram": patch
---

A live audio chart keeps drawing its previews while `useLiveAudioRunner` replaces its runner, rather than painting closed bitmaps until the new runner's run arrives. A disposed `LiveAudioRunner` leaves its last run's previews open until `drawn` reports a render without them.

<!-- entry: fix behavior -->
