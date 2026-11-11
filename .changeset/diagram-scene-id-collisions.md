---
"@weasel-js/diagram": patch
---

`diagramScene` refuses data in which two specs would share an id, with an error naming it: a node named like another item's part (`a/1` beside a node `a`, or `G/label` inside a titled group `G`), an edge whose `id` is a node's, or one edge `id` given to two different edges. These built specs that `createScene` then refused with an id collision, and the second of two different edges sharing an `id` was dropped without a word. An exact repeat of an edge is still dropped.
