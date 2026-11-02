---
"@weasel-js/stroke": patch
"@weasel-js/core": patch
"@weasel-js/svg": patch
"@weasel-js/pdf": patch
"@weasel-js/labkit": patch
---

Seat a marker head the line stops short of on the shaft's cut end. The head's back now sits on the end of the shortened shaft and points along the shaft there, so a curving shaft enters the back of an arrowhead square instead of poking out its side; the tip lands the head's inset past the cut. The canvas, PDF, and outlined strokes place heads through `markerHeads`, and `markerSites` takes the insets as a new optional argument.

SVG export follows the same rule: it cuts the stroked shaft back by each start and end head's inset and moves the head's `<marker>` reference point back to match, so any viewer's `orient="auto"` draws the head the way the canvas does. The element keeps its path as authored in `wzl:d`, and import reads it back, along with the kit marker it references. A mid marker, or an end too short to cut, references an unseated `-tip` def.

PDF export strokes an inset-headed shaft natively, cut back by exact arc length, instead of filling a flattened outline, which showed facets on curves when zoomed. The cut is the new `insetPath` from `@weasel-js/stroke`, which the SVG writer uses too.

A `TrialSceneCanvas` is now its trial's camera, so the lab header's zoom buttons, readout, and zoom keys drive a scene lab's view.
