---
'@weasel-js/forge': patch
---

`defineFrameConfig` and the `forge` plugin's `frameConfig` option: the docs said only frame documents import the frame config, so its CSS stays out of the workshop. The workshop page imports it too, to set up the stories it renders in its own document, so a page-level rule in CSS the frame config imports styles the workshop as well. The docs now say so.
