---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Trim segment. `useTrimTool` (key Y) hands a click to the new `trimPath` action, which removes the clicked piece of a stroke between the nearest crossings on either side, with any other node's outline or with the stroke itself. Curves split where they are cut and stay curves, a closed shape opens, an end piece runs back to the first crossing, and a stroke with nothing left is deleted, each as one undo step. While the tool is up it draws the piece under the pointer dashed, from the same `planTrim` the click commits. The action is in the standard actions and the `paths` preset.

Extend to next path. The new `extendToMeet` action carries open ends along their tangent to the next stroke they meet: the selection's ends, the selected end anchors in path edit, or, with `useExtendTool` (key U), the end nearest a click. A straight end grows longer and a curved one gains a straight run. It is in the standard actions and the `paths` preset, with no key of its own.

`@weasel-js/geom` adds what these stand on: `intersectSegments`, `pathSegments`, `pathCrossings`, `trimPathAt`, and `extendToMeet`, `lengthenOpenEnd`, `openEndRay`, and `openPathEnds`.
