---
'@weasel-js/ui': major
'@weasel-js/labkit': major
---

Playhead controls report a move with `onSeek` and play state with `playing` and `onPlayingChange`, one spelling across them.

`Timeline`, `TimeRuler` and `Jog` take `onSeek` where they took `onScrub`. `Transport` takes `playing` where it took `paused`, and one `onPlayingChange(next)` where it took `onPlay` and `onPause`; `useTimelinePlayback` returns the same.

```tsx
// before
<Transport paused={!playing} onPlay={play} onPause={pause} … />
<TimeRuler … playhead={t} onScrub={setT} />
// after
<Transport playing={playing} onPlayingChange={(next) => (next ? play() : pause())} … />
<TimeRuler … playhead={t} onSeek={setT} />
```

<!-- entry: breaking api -->
