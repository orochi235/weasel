---
'@weasel-js/diagram': patch
---

A body's label rows are centered in their row (`rowTextStyle`, used by `diagramScene` and by stencils alike); field rows stay left-aligned. `formatParam` shows a number to as many places as its control's `step` has, and never prints `-0.0`. `EffectEditor` pins every stage where it shows on a drag, as adding a stage already did, so layout no longer moves the stages nobody placed, and a delete clears its picked wire. `dropEmptyEdgeLabel` removes an edge label whose edit ended with no text; pass it as a text edit's `onEnd`.
