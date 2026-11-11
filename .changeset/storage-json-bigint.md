---
"@weasel-js/storage": patch
---

`localStorageAdapter`, `sessionStorageAdapter`, and `urlHashAdapter` write a `bigint` as its decimal digits, with their usual warning about a value JSON changes. A write holding one rejected with a `TypeError`, so a record cache sent it again on a backoff forever.
