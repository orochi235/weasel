---
'@weasel-js/geom': patch
---

Path structure edits on an `AnchorSet`: `setSubpathStart(set, flatIndex)` makes an anchor its subpath's first — a closed subpath turns to start there, an open one reverses when given its last anchor — and `reverseSubpaths(set, subs?)` runs subpaths the other way without changing their shape, a closed one keeping its start anchor. `flatIndexesAfterReverse` says where a selection's anchors went, `subpathsOfAnchors` which subpaths hold them, and `directionMarks(set)` gives a point and heading at the middle of every segment, for drawing which way a path runs. Anchors move whole, so anything an anchor carries beside its point and handles goes with it.

Segments convert in place: `convertSegments(set, segs, to?)` turns lines into curves with handles at their thirds, drawing the same line, and curves into lines by dropping the two handles that shape them; with no `to` it flips the lot. `segmentsBetweenAnchors(set, flatIndexes)` names the segments whose two ends are selected, and `isSegmentStraight` reads one.

Anchors as typed numbers: `readAnchorFields(set, flatIndexes)` answers the selected anchors' X and Y — `null` where they differ — and a lone anchor's handle X, Y, angle and length; `writeAnchorField(set, flatIndexes, field, entry)` sets a value on every anchor or offsets each by an amount (`{ to }` or `{ by }`).

`remapAnchorValues(values, stride, before, after, origins)` carries an array kept per anchor, such as vertex colors, through an edit `editAnchorSetTracked` reported, and `anchorOriginsOf(before, after, origins)` says where each anchor came from, for arrays that need more than a blend. A `PointOrigin` on an anchor's own point now carries `reversed: true` when its subpath runs the other way through it after the edit, read from which way its neighbors followed it before.

A typed handle moves as a drag to that spot would: on a smooth anchor the opposite handle mirrors it, turning with it and taking its length, and on a corner it stays put.
