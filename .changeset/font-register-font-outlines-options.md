---
'@weasel-js/font': major
---

`OutlineFontOptions` is `RegisterFontOutlinesOptions`, named for `registerFontOutlines`, which takes it.

```ts
// before
const opts: OutlineFontOptions = { cssSrc: 'local("Inter")' };
// after
const opts: RegisterFontOutlinesOptions = { cssSrc: 'local("Inter")' };
```

<!-- entry: breaking api -->
