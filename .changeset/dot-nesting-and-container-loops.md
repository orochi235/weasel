---
'@weasel-js/diagram-formats': patch
---

DOT refuses subgraphs nested more than 1000 deep with an error naming the line, where it ran out of stack. The DOT and Mermaid writers write the nodes of containers that hold each other in a loop, with a warning, where they dropped them and the containers silently.
