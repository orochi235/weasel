---
'@weasel-js/labkit': major
---

A labkit number's `.suffix('px')` is the prefs leaf's `unit: { scale: 1, suffix: 'px' }`, so `PrefsForm` shows it as the lab's panel does.

`Annotations` and `LeafPatch` lose `suffix`: a rule or a hand-built leaf sets the unit's instead. Between `.suffix` and `.unit`, the one called last names the suffix, and `.suffix` keeps a unit's scale. A field now also reads the suffix typed after a number, and a field sweep labels its values through the unit.

```ts
// before
const rule: ConfigRule = ({ key }) => (key.endsWith('Ms') ? { suffix: 'ms' } : null);
// after
const rule: ConfigRule = ({ key }) => (key.endsWith('Ms') ? { unit: { scale: 1, suffix: 'ms' } } : null);
```

<!-- entry: breaking api -->
