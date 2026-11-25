---
'@weasel-js/forge': patch
---

forge's dev server refuses an issues request whose `Host` or `Origin` is not its own, so a page on another site that rebinds its name to this machine cannot read the repository, branch, commit, or issue list.

<!-- entry: fix -->
