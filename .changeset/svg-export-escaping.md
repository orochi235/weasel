---
'@weasel-js/svg': patch
---

`serializeSvg` wrote characters XML cannot hold, so a text node containing a vertical tab (the soft line break a word processor puts on the clipboard) or another control character saved a file that reopened empty. Those characters are now left out, with a vertical tab or form feed written as a newline. A tab or line break inside an attribute value (a font family, an `href`, namespaced metadata) is written as a character reference instead of coming back as a space, and a color, marker key, or font weight holding `"`, `<`, or `&` is escaped.
