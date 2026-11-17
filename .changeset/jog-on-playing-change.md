---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

`Jog` reports its play button through `onPlayingChange(next)`, the name for a callback that hears pause as well as play.

```tsx
// before
<Jog index={i} count={n} playing={playing} onPlay={setPlaying} onStep={step} onScrub={seek} />
// after
<Jog index={i} count={n} playing={playing} onPlayingChange={setPlaying} onStep={step} onScrub={seek} />
```

<!-- entry: breaking api -->
