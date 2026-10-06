---
'@weasel-js/forge': patch
---

A story can declare a timeline — `timeline: { duration, start?, loop?, rate? }` on a native story or meta, `parameters.forge.timeline` in CSF, or a function of the config or args — and forge then owns its clock. The trial gets a scrub bar and `@weasel-js/ui`'s `Transport` in its status bar, and the story reads the playhead with `usePlayhead()`, or the whole clock with `useTimeline()`, which can also play, pause, seek and replace the span at runtime. Times are in ms. The paused time is kept with the trial, so a reload or a labkit snapshot restores it. While paused, the playhead is also held in the URL as `t` in seconds (`#/<story>?t=1.5`), by the one trial that owns the URL (the focused trial showing the routed story, else the first); opening such a URL, or a hash change bringing a new `t`, puts that trial paused there. Playing clears `t` once instead of rewriting the URL every frame.
