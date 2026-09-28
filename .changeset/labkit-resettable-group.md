---
'@weasel-js/labkit': patch
---

`f.group(...).resettable()` puts a reset button on the group's heading in `ControlPanel`. It writes the default of every value beneath the group that differs from it, leaving the rest of the config alone, and is disabled while nothing has changed. The trial's own Reset still returns everything.
