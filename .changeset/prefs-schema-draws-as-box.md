---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`prefAsBox` is renamed `prefDrawsAsBox`, since it is a predicate.

```ts
// before
if (prefAsBox(group.as)) drawBox(group);
// after
if (prefDrawsAsBox(group.as)) drawBox(group);
```

<!-- entry: breaking api -->
