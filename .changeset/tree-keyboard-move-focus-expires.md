---
'@weasel-js/ui': patch
---

`Tree` no longer moves focus to a node long after an Alt+arrow move that changed nothing. Focus follows a moved node on the render the move causes; when `onMove` leaves `nodes` as they were, or updates them more than a frame later, the tree used to hold on to that node and focus it on the next unrelated render. It now gives up after one frame, so a move that lands later than that leaves focus where it is.
