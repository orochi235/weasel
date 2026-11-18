---
'@weasel-js/quantity': major
---

`endless` is `withInfinity`, since it returns a display with its own word for infinity rather than making anything endless.

```ts
// before
const timeout = endless(unit('ms'), 'never');
// after
const timeout = withInfinity(unit('ms'), 'never');
```

<!-- entry: breaking api -->
