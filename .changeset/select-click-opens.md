---
'@weasel-js/ui': patch
---

A click opens a `<Select>`'s list and leaves it open. With the list over its
trigger, the release that ended the opening click landed on a row, and a row
selects on release — so the list shut again before it had been seen, and
opening it took a press and hold. A release within 500ms and 4px of the press
that opened the list now belongs to the trigger; every release after it picks
a row, so press-hold-drag-release still chooses.

A select showing its placeholder hangs its list below the trigger instead of
over it: nothing is chosen, so no row belongs over the trigger, and putting an
arbitrary one under the pointer armed it.
