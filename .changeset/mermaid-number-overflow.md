---
'@weasel-js/diagram-formats': patch
---

A Mermaid pie, sankey, xychart, radar, or quadrant number too large to hold, such as `1e400`, is refused naming its
line, where it was read as infinity and written back as `Infinity`, which no reader takes.
