---
'@weasel-js/forge': patch
---

The pages the `forge` plugin serves and builds carry the shell config's `title` in their `<title>`, read from the config module's source, so a tab, a crawler, or a link preview no longer reads `weaselforge` until the workshop has loaded. A title the source does not spell out, such as one a function computes, still applies only once the workshop runs.
