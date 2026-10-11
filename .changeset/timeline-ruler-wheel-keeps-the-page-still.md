---
'@weasel-js/ui': patch
---

A wheel over `Timeline`'s ruler no longer moves the page as well. A pinch or Ctrl-wheel zoomed the timeline and the browser page together, and a plain wheel panned the window while scrolling whatever was under it. The ruler now takes the wheel for itself, handing it back to the page only when the window is already at the end it is being panned toward. A sideways trackpad swipe pans too.
