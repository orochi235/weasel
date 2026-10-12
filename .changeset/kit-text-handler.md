---
'@weasel-js/core': patch
---

Adds API: `kitTextHandler`, a content handler that turns pasted or dropped plain text into a text node. The node's box is the string's laid-out size at the default text style, placed where the image handler places an image: on the drop point, or centered in the viewport for a paste. It runs below every other kit handler, so SVG markup and a copied node payload arriving as plain text still go to the handlers that read them.

No canvas registers it by default. Opt in with `<SceneCanvas ingestion={{ handlers: [kitTextHandler] }}>`. Sizing the box by measuring the string, and leaving the handler off by default, were decided on an agent's judgment.
