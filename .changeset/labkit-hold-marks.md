---
'@weasel-js/labkit': minor
---

A panel can show a lab's marks while it needs them, whatever View → Marks says, with `useHoldMarks(held)`.

The hold is never stored: when it ends, the lab goes back to its Marks switch. `LabContextValue` gains `holdMarks()`, which returns the release; a test that builds its own `LabContext` value supplies one.

<!-- entry: api -->
