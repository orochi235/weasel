---
'@weasel-js/labkit': patch
---

Annotation tools now live in the lab's tool rail and write the lab's tool slot, so one tool is armed across every trial. A trial whose instrument declares `annotations` no longer gets a palette or a tool slot of its own; a lab whose own `tools` reuse an annotation tool id (`select`, `rect`, …) now throws on the collision.
