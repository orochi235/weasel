---
'@weasel-js/forge': patch
---

forge's issues endpoint answers its 502 error body, with the checkout's repo, branch, and commit, when `gh` prints JSON that is not a list of issues.

<!-- entry: fix -->
