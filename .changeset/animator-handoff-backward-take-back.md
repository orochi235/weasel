---
'@weasel-js/animator': patch
---

A run handed to the compositor and taken back while it played backward committed where it stood, rather than keeping its destination committed as a run on the main thread does. A `target.commit(target.committed())` then jumped the element to the destination, and a tween started on it then landed in the wrong place.
