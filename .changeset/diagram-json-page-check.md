---
'@weasel-js/diagram-formats': patch
---

The Diagram JSON reader refuses a document with a page that is not an object, or whose `kind` it does not know, with an error saying so, rather than failing with a `TypeError` or passing the page on.
