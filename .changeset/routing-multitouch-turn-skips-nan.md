---
'@weasel-js/routing': patch
---

A multitouch gesture's `rotation` skips an angle that is not a finite number. One such angle made the turn `NaN`
for the rest of the gesture; a gesture that opens on one now turns from its first finite angle.
