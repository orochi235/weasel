---
'@weasel-js/storage': patch
---

`createIndexedDbAdapter` opens its database again after losing it. One failed or blocked open used to be kept for the life of the page, so every later read and write failed the same way and a record cache's retries could never land; the same held once the browser closed the connection. The adapter now opens a new connection on the next call. It also closes its connection when another tab asks to delete or upgrade the database, which used to stay blocked for as long as this tab was open.
