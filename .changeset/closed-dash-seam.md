---
'@weasel-js/core': patch
---

A closed subpath's dash no longer seams at its start vertex

`splitForDash` flushed the run still open when a closed subpath's walk returned
to the vertex it started from as its own open sub-polyline, so it and the run
that began there rendered as two butt-capped ribbons meeting at a point — a
notch on the corner of any dashed rectangle whose perimeter isn't a whole
multiple of the pattern. They are joined now, and the join the stroke asked for
is drawn across the seam like any other corner. A pattern whose first "on"
length covers the whole perimeter emits a closed ribbon, identical to the
undashed stroke.
