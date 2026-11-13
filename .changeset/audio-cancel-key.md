---
'@weasel-js/audio': major
---

The audio engine's `stopKey(key)` is `cancelKey(key)`, the name of the play option it reads and of the animator's method that does the same.

```ts
// Before
engine.play('hit', { cancelKey: 'sfx-hit' });
engine.stopKey('sfx-hit');

// After
engine.play('hit', { cancelKey: 'sfx-hit' });
engine.cancelKey('sfx-hit');
```

<!-- entry: breaking api -->
