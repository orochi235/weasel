---
'@weasel-js/diagram': patch
---

Avoid-routed connectors no longer steer around the label of a connector that found no path as if it still sat on that connector's old route.

The label is avoided where it is drawn, on the line the connector falls back to.

<!-- entry: fix visual -->
