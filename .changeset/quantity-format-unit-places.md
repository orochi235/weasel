---
'@weasel-js/quantity': major
---

`formatUnit`, `formatScoped` and `formatAxes` take their decimal places as `places`, as quantity's displays do; the option was `precision`.

```ts
// before
formatUnit(13, 'ft', IMPERIAL_INCHES, { precision: 3 });
// after
formatUnit(13, 'ft', IMPERIAL_INCHES, { places: 3 });
```

<!-- entry: breaking api -->
