---
"@weasel-js/text-dom": patch
---

Typing at the start of a line held by a hard break the overlay stands in for (U+2028, U+2029, a vertical tab, a form feed, a lone carriage return, or NEL) no longer turns that break into a line feed. Text typed ahead of the stand-in's newline now reads back with the original break after it.
