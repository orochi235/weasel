---
'@weasel-js/ui': minor
---

`SelectionPanel` takes the canvas's `features`, and reads the routing and properties their node kinds bring from them.

`routing` and `properties` are now optional, defaulting to `inferredNodeRouting` and `inferredNodeProperties`, and a name either gives keeps the consumer's entry over a preset's.

```tsx
<SelectionPanel scene={scene} selection={selection} features={features} />
```

<!-- entry: new api -->
