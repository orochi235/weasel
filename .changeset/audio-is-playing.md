---
'@weasel-js/audio': major
---

A pattern player, a score and an audio graph answer `isPlaying()`, as a voice handle does, in place of `playing()`.

```ts
// Before
if (pattern.playing()) pattern.stop();

// After
if (pattern.isPlaying()) pattern.stop();
```

<!-- entry: breaking api -->
