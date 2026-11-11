---
"@weasel-js/ui-logic": patch
"@weasel-js/ui": patch
---

An ordered slider thumb never leaves its bounds. When its neighbor sat too close for the step it keeps from it, `clampOrdered` put the thumb a step past the neighbor anyway, beyond the end of the track or the thumb's own limits; it now holds the thumb between its neighbors and inside its bounds. A drag and a track click on an ordered `Slider` keep a thumb inside its `bounds` the way its arrow keys already did.
