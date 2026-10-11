---
'@weasel-js/ui': patch
---

`BandEditor` called `onChange` for drags that changed nothing: a seam brought back to where it started, and a click on a middle band, which also moved the band by however far the pointer slipped. A band body now moves only once the pointer passes the drag threshold, and a seam or band released where it started commits nothing.
