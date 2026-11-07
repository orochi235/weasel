---
'@weasel-js/diagram-formats': patch
---

Reading a DOT graph whose every node has a `pos` but which gives no `bb`, the page now spans the nodes' own extent. It used to start at DOT's origin, so a node left of or below it was placed off the page. A `pos` or `bb` holding a value that is not a finite number is now treated as missing rather than read as an infinite place.
