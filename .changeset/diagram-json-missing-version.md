---
'@weasel-js/diagram-formats': patch
---

Reading diagram JSON with a missing or non-numeric `version` says so, rather than calling the file newer than the reader.

<!-- entry: fix -->
