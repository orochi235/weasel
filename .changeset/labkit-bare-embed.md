---
'@weasel-js/labkit': minor
---

`?bare` in a lab's URL presents it with no chrome. `?bare=still` and `?bare=still=<ms>` also hold it still, and `&bg=<hex>` paints the color behind it.

`bg` takes 3, 4, 6 or 8 hex digits, so it can carry alpha. `bareOf(search?)` reads the same parameters for a page that wants them itself.

<!-- entry: new api -->
