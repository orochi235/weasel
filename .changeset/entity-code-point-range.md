---
'@weasel-js/diagram-formats': patch
---

A numbered character reference past the last code point, such as `&#99999999;`, in a DOT HTML label threw a `RangeError` and failed the whole import; it is now kept as written, as draw-style XML already kept it. Both readers now decode references the one way.
