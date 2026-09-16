---
'@weasel-js/labkit': patch
---

`LabShell`'s header lines its controls up at one height and one middle by
default. A toolbar placed in the header takes the header's control height rather
than the compact 22px trial toolbars use, and drops the strip's padding, border
and background. `<Lab>`'s color-mode toggle runs at the control height instead of
its small size.
