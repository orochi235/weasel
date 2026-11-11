---
"@weasel-js/p-touch": patch
---

The `.lbx` writer writes every hard line break in a text box as one line feed, so it reads back as one line. That covers `\r\n`, `\r`, U+2028 and the rest UAX #14 names.

<!-- entry: fix data -->
