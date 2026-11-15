---
'@weasel-js/core': major
---

A preset's tool whose `insert` bindings all name a kind nothing on the canvas builds is left out of its tools.

The canvas warns in development when it leaves one out. This is a breaking change for a host that builds such a kind through its own `insert` dep source rather than a factory: give the factory through `insertNodeFactories` or a preset's `insertNodeFactories` instead, and the tool stays.

```tsx
// before: a preset's `gem` tool, built by an overridden insert dep
useDepSource('insert', () => myInsertDep);
// after
<SceneCanvas features={[gemTools]} insertNodeFactories={{ gem: gemFactory }} />
```

<!-- entry: breaking behavior -->
