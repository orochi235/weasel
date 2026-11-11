---
"@weasel-js/diagram": patch
---

The obstacle-avoiding router keeps its promises in more scenes. Spreading parallel runs apart no longer moves one into a shape's clearance, including a run of a connector the update did not reroute, which was spread back to where it ran before a shape moved next to it; such a connector is now rerouted. Routes no longer depend on where a scene sits: moving a whole diagram moves its routes with it, where they had switched between equally short paths. A connector with no path is answered again only when something it depends on changes, rather than on every update, and one that a label's interim spot blocked is routed in the same update.
