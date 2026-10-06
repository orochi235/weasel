---
'@weasel-js/forge': patch
---

A story can declare a timeline — `timeline: { duration, start?, loop?, rate? }` on a native story or meta, `parameters.forge.timeline` in CSF, or a function of the config or args — and forge then owns its clock. The trial gets a scrub bar and `@weasel-js/ui`'s `Transport` in its status bar, and the story reads the playhead with `usePlayhead()`, or the whole clock with `useTimeline()`, which can also play, pause, seek and replace the span at runtime. Times are in ms. While paused, the playhead is held in the URL as `t` in seconds (`#/<story>?t=1.5`), and opening such a URL starts the story paused there. Playing clears `t` once instead of rewriting the URL every frame.
