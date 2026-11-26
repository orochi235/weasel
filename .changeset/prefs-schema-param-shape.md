---
'@weasel-js/prefs-schema': minor
'@weasel-js/prefs': minor
---

A library can describe its tunable params as plain JSON with `ParamShape`, and read their starting values with `paramDefaults`.

A param is a `number` (`min`, `max`, `step`, `suffix`), `boolean`, `enum` (bare or `{ value, label }` options) or `color` (`alpha`), each with an optional `label`, `description`, `default` and `auto`; a `group` nests params under one key. A runtime library imports the types from `@weasel-js/prefs-schema` without taking in a store, React or labkit.

```ts
import { type ParamShape, paramDefaults } from '@weasel-js/prefs-schema';

export const PARAMS = {
  count: { kind: 'number', label: 'Cells', default: 48, min: 6, max: 160, step: 1 },
  tint: { kind: 'color', default: '#ffd27a' },
} as const satisfies ParamShape;

paramDefaults(PARAMS); // { count: 48, tint: '#ffd27a' }
```

<!-- entry: rank=5 new api -->
