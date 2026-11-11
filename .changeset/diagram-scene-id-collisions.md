---
"@weasel-js/diagram": patch
---

`diagramScene` refuses data in which two specs would share an id, with an error naming the id. That covers a node named like another item's part (`a/1` beside a node `a`, or `G/label` inside a titled group `G`), an edge whose `id` is a node's, and one edge `id` given to two different edges. An exact repeat of an edge is still dropped.

<!-- entry: behavior fix -->
