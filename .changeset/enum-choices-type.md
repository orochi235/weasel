---
'@weasel-js/labkit': patch
---

`f.enum` types its leaf by its choices, whether they are plain strings or `{ value, label }` options.
With labeled options it used to take the type from the default alone, so
`f.enum('perspective', [{ value: 'free', … }, { value: 'perspective', … }])` gave `'perspective'` and
left out `'free'`. Both forms now give the union of their values, and a default that isn't one of
the choices no longer compiles. `ConfigOption` takes the value type as a parameter
(`ConfigOption<V extends string = string>`). Options built at runtime with `Object.entries` need their
keys cast back to the choice type.
