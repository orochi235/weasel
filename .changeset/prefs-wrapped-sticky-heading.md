---
"@weasel-js/ui": patch
---

A row scrolled to in `PrefsForm` now stops below its section's sticky heading when the heading's name wraps to more than one line. The rows' `scroll-margin-top` follows the heading's measured height; it used to assume one line, and left the first row under a wrapped heading.
