---
'@weasel-js/forge': patch
---

forge: the dev server warns when the OS is not reporting file changes. At startup it writes a file in a temp directory of its own and, when no event for it arrives in 5 seconds, logs that edits will not reach the page and names `server.watch: { usePolling: true }` as the way to serve them meanwhile. A server that polls, or that has `server.watch: null`, is not checked. Additive.
