---
'@weasel-js/diagram-formats': patch
---

Draw-style XML now writes and reads BPMN's events, gateways and subprocess and the network devices as draw.io's own shapes (`mxgraph.bpmn.event`, `mxgraph.bpmn.gateway2`, `mxgraph.bpmn.task`, and `mxgraph.networks.*`), each with its label below the figure, where it used to write them as rectangles with a warning. A BPMN event or gateway draw.io draws that has no outline here, such as an end event or a complex gateway, reads as the nearest one. The network `globe` still goes out as a rectangle. Mermaid, which has no such figures, now writes an event as a circle, an intermediate event as a double circle, a gateway as a diamond without its marker, and a subprocess as a rounded rectangle, with a warning saying so.
