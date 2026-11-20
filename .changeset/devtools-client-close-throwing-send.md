---
'@weasel-js/devtools': patch
---

A devtools client whose transport throws on `yo` or `bye` still opens again later, and `close()` still closes and rejects its pending requests.

A throwing `yo` leaves the client in `error` with the transport's message.

<!-- entry: fix -->
