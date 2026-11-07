---
'@weasel-js/stroke': patch
---

A zero-length dash that falls exactly on an open line's last point draws its round or square cap, as one mid-line does. It was dropped, so a round-capped `dash: [0, gap]` line whose length was a whole number of gaps had no dot at its end.
