---
'@weasel-js/labkit': minor
---

A config schema can ask for a text box and a menu button: `f.string(…).textarea()` and `f.enum(…).menu()`.

Both controls were drawn by `ControlPanel` already, and reachable only through `f.prefs` or by setting `control` by hand.

```ts
f.schema({
  notes: f.string('').textarea(),
  blend: f.enum('normal', ['normal', 'multiply', 'screen']).menu(),
});
```

<!-- entry: new api -->
