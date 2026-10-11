---
'@weasel-js/forge': patch
---

The `forge` vite plugin takes `frameStyles`, a list of stylesheets that only the frame document loads. A frame config's own CSS imports still reach the workshop page as well, so a rule on `html, body` meant for frames belongs in `frameStyles`.
