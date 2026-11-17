---
'@weasel-js/routing': minor
---

A key binding can declare `inFields: true` to hear a Ctrl or Cmd chord typed in a text field.

Every other key binding still leaves a key typed in a field to the field.

```ts
defaultBinding: [{ spec: { kind: 'key', key: 's', mods: { mod: true } }, opts: { inFields: true } }],
```

<!-- entry: new api -->
