---
'@weasel-js/text': major
---

`ownSmallCaps` is `hasOwnSmallCaps`, prefixed like the other predicates.

```ts
// before
if (ownSmallCaps(family, 400, 'normal')) return run;
// after
if (hasOwnSmallCaps(family, 400, 'normal')) return run;
```

<!-- entry: breaking api -->
