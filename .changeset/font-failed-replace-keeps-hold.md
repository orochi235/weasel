---
'@weasel-js/font': patch
---

A font variant whose `replace` fetch fails keeps holding the URLs of the atlas it still draws.

Registering it again with other URLs throws, or takes `replace`, as it would before the failed attempt.

<!-- entry: fix -->
